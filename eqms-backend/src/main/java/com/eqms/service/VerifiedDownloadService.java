package com.eqms.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.channels.OverlappingFileLockException;
import java.nio.file.*;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;
import static java.nio.file.StandardOpenOption.*;

/** Fully verifies into a private, bounded spool before any HTTP body can be sent. */
@Service
public class VerifiedDownloadService implements org.springframework.beans.factory.DisposableBean {
    public static final class Busy extends IllegalStateException { public Busy(){super("DOWNLOAD_CAPACITY_BUSY");} }
    private final FileStorageService storage;
    private final Path root;
    private final Semaphore slots;
    private final long maxBytes;
    private final Set<Prepared> active=ConcurrentHashMap.newKeySet();
    private volatile boolean stopping;

    @Autowired
    public VerifiedDownloadService(FileStorageService storage,
            @Value("${app.downloads.spool-directory:${java.io.tmpdir}/eqms-verified-downloads}") String root,
            @Value("${app.downloads.max-concurrent:4}") int concurrency,
            @Value("${app.downloads.max-bytes:268435456}") long maxBytes) {
        this(storage,Path.of(root),concurrency,maxBytes);
    }
    VerifiedDownloadService(FileStorageService storage,Path root,int concurrency,long maxBytes) {
        if(concurrency<1||concurrency>32||maxBytes<1)throw new IllegalArgumentException("Invalid verified download limits");
        this.storage=storage;this.root=root.toAbsolutePath().normalize();this.slots=new Semaphore(concurrency);this.maxBytes=maxBytes;
    }

    public Prepared prepare(String objectKey,String sha256) throws IOException {
        if(sha256==null||!sha256.matches("[a-fA-F0-9]{64}"))throw new IOException("DOWNLOAD_CHECKSUM_REQUIRED");
        if(stopping||!slots.tryAcquire())throw new Busy();
        Path path=null;FileChannel channel=null;
        try {
            Files.createDirectories(root);
            path=Files.createTempFile(root,"download-",".tmp");
            channel=FileChannel.open(path,READ,WRITE,LinkOption.NOFOLLOW_LINKS);
            FileLock lock=channel.lock(); // Kept until HTTP completion; the janitor cannot remove a live spool.
            MessageDigest digest=MessageDigest.getInstance("SHA-256");
            long size=0;
            try(var source=storage.openStoredFile(objectKey)) {
                byte[] buffer=new byte[64*1024];int read;
                while((read=source.read(buffer))!=-1) {
                    if(read==0)continue;
                    size+=read;if(size>maxBytes)throw new IOException("DOWNLOAD_SIZE_LIMIT_EXCEEDED");
                    digest.update(buffer,0,read);
                    var bytes=ByteBuffer.wrap(buffer,0,read);while(bytes.hasRemaining())channel.write(bytes);
                }
            }
            if(!MessageDigest.isEqual(digest.digest(),HexFormat.of().parseHex(sha256)))throw new IOException("DOWNLOAD_CHECKSUM_MISMATCH");
            channel.position(0);
            var prepared=new Prepared(path,channel,lock,size);
            synchronized(active){if(stopping)throw new Busy();active.add(prepared);}
            return prepared;
        } catch(Exception failure) {
            if(channel!=null)try{channel.close();}catch(IOException cleanup){failure.addSuppressed(cleanup);}
            if(path!=null)try{Files.deleteIfExists(path);}catch(IOException cleanup){failure.addSuppressed(cleanup);}
            slots.release();
            if(failure instanceof IOException io)throw io;
            if(failure instanceof RuntimeException runtime)throw runtime;
            throw new IOException("Could not prepare verified download",failure);
        }
    }

    public final class Prepared implements AutoCloseable {
        private final Path path;
        private final FileChannel channel;
        @SuppressWarnings("unused") private final FileLock lock;
        private final long size;
        private boolean closed;
        private Prepared(Path path,FileChannel channel,FileLock lock,long size){this.path=path;this.channel=channel;this.lock=lock;this.size=size;}
        public long size(){return size;}
        public void transferTo(OutputStream output) throws IOException {
            var buffer=ByteBuffer.allocate(64*1024);
            while(channel.read(buffer)!=-1){output.write(buffer.array(),0,buffer.position());buffer.clear();}
        }
        @Override public synchronized void close() throws IOException {
            if(closed)return;closed=true;
            try{channel.close();}finally{
                try{Files.deleteIfExists(path);}finally{active.remove(this);slots.release();}
            }
        }
    }

    /** Only disposable copies, never source objects. File locks protect live transfers across processes. */
    @Scheduled(initialDelay=60000,fixedDelay=3600000)
    public void removeAbandonedSpools() {
        if(!Files.isDirectory(root))return;
        Instant cutoff=Instant.now().minus(Duration.ofHours(2));
        try(var files=Files.newDirectoryStream(root,"download-*.tmp")) {
            for(Path path:files) {
                try {
                    if(!Files.isRegularFile(path,LinkOption.NOFOLLOW_LINKS)||Files.getLastModifiedTime(path,LinkOption.NOFOLLOW_LINKS).toInstant().isAfter(cutoff))continue;
                    boolean disposable=false;
                    try(var file=FileChannel.open(path,READ,WRITE,LinkOption.NOFOLLOW_LINKS);var lock=file.tryLock()) {disposable=lock!=null;}
                    if(disposable)Files.deleteIfExists(path);
                } catch(IOException|OverlappingFileLockException busyOrGone) { /* A live/locked file is retained. */ }
            }
        } catch(IOException unavailable) { /* Next sweep retries disposable spools. */ }
    }

    @Override public void destroy() {
        synchronized(active){stopping=true;}
        for(var prepared:active)try{prepared.close();}catch(IOException ignored){/* janitor on a later start */}
    }
}

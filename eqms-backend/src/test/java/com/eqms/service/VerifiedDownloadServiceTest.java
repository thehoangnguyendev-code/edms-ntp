package com.eqms.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.io.*;
import java.nio.file.*;
import java.nio.file.attribute.FileTime;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class VerifiedDownloadServiceTest {
    @TempDir Path root;
    FileStorageService storage=mock(FileStorageService.class);
    String hash(byte[] data)throws Exception{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data));}
    long count()throws Exception{try(var files=Files.list(root)){return files.count();}}

    @Test void streamsVerifiedBytesWithoutWholeFileReadsAndReleasesSlotIdempotently()throws Exception {
        byte[] bytes=new byte[3*1024*1024];new java.util.Random(42).nextBytes(bytes);
        when(storage.openStoredFile("key")).thenAnswer(call->new ByteArrayInputStream(bytes){
            @Override public byte[] readAllBytes(){throw new AssertionError("Must not buffer entire object");}
        });
        var service=new VerifiedDownloadService(storage,root,1,bytes.length);
        var prepared=service.prepare("key",hash(bytes));assertEquals(bytes.length,prepared.size());
        assertThrows(VerifiedDownloadService.Busy.class,()->service.prepare("key",hash(bytes)));
        var output=new ByteArrayOutputStream();prepared.transferTo(output);assertArrayEquals(bytes,output.toByteArray());
        prepared.close();prepared.close();assertEquals(0,count());
        try(var next=service.prepare("key",hash(bytes))){assertEquals(bytes.length,next.size());}
    }

    @Test void mismatchInterruptedSourceAndOversizedSourceLeaveNoSpoolOrLostPermit()throws Exception {
        byte[] bytes="verified".getBytes();
        when(storage.openStoredFile("good")).thenAnswer(call->new ByteArrayInputStream(bytes));
        when(storage.openStoredFile("broken")).thenAnswer(call->new InputStream(){public int read()throws IOException{throw new IOException("interrupted");}});
        var service=new VerifiedDownloadService(storage,root,1,bytes.length);
        assertThrows(IOException.class,()->service.prepare("good","0".repeat(64)));assertEquals(0,count());
        assertThrows(IOException.class,()->service.prepare("broken",hash(bytes)));assertEquals(0,count());
        when(storage.openStoredFile("large")).thenReturn(new ByteArrayInputStream(new byte[bytes.length+1]));
        assertThrows(IOException.class,()->service.prepare("large",hash(bytes)));assertEquals(0,count());
        try(var prepared=service.prepare("good",hash(bytes))){assertEquals(bytes.length,prepared.size());}
        assertEquals(0,count());
    }

    @Test void disconnectCleansSpoolAndJanitorRetainsLiveOrUnrelatedFiles()throws Exception {
        byte[] bytes="verified".getBytes();when(storage.openStoredFile("key")).thenAnswer(call->new ByteArrayInputStream(bytes));
        var service=new VerifiedDownloadService(storage,root,1,100);
        var prepared=service.prepare("key",hash(bytes));
        Path live;try(var files=Files.list(root)){live=files.findFirst().orElseThrow();}
        var old=FileTime.from(Instant.now().minusSeconds(3*3600));Files.setLastModifiedTime(live,old);
        Path abandoned=Files.writeString(root.resolve("download-abandoned.tmp"),"disposable");Files.setLastModifiedTime(abandoned,old);
        Path unrelated=Files.writeString(root.resolve("source.pdf"),"keep");Files.setLastModifiedTime(unrelated,old);
        service.removeAbandonedSpools();assertTrue(Files.exists(live));assertFalse(Files.exists(abandoned));assertTrue(Files.exists(unrelated));
        assertThrows(IOException.class,()->{try(prepared){prepared.transferTo(new OutputStream(){public void write(int value)throws IOException{throw new IOException("client disconnected");}});}});
        assertFalse(Files.exists(live));try(var next=service.prepare("key",hash(bytes))){assertEquals(bytes.length,next.size());}
    }

    @Test void shutdownClosesPreparedFilesAndRejectsNewWork()throws Exception {
        byte[] bytes={1};when(storage.openStoredFile("key")).thenReturn(new ByteArrayInputStream(bytes));
        var service=new VerifiedDownloadService(storage,root,1,100);var file=service.prepare("key",hash(bytes));
        service.destroy();assertEquals(0,count());file.close();
        assertThrows(VerifiedDownloadService.Busy.class,()->service.prepare("key",hash(bytes)));
    }
}

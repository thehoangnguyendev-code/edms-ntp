package com.eqms.service.training;

import com.eqms.repository.ElectronicSignatureRepository;
import com.eqms.service.ElectronicSignatureService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * The electronic signature as it is written in a form: the Standard frame, the only way a signature is written in a document (the name, "Electronically" and the meaning, then the date and time),
 * in the font size that the configuration gives. The text is the same as in the signed documents because it is made by the same renderer from the record of the signature.
 */
@Service
public class TrainingSignatureBlocks {
    private final ElectronicSignatureRepository repository;
    private final ElectronicSignatureService signatures;
    private final JdbcTemplate jdbc;

    public TrainingSignatureBlocks(ElectronicSignatureRepository repository, ElectronicSignatureService signatures, JdbcTemplate jdbc) {
        this.repository = repository;
        this.signatures = signatures;
        this.jdbc = jdbc;
    }

    /** The lines of the block of one signature of a form of the Training Annex: the Standard frame, as every signature of a document. */
    @Transactional(readOnly = true)
    public List<String> lines(UUID signatureId, String code, String slot) {
        return lines(signatureId);
    }

    /** The reason the signer typed in the electronic signature window; null when there is no such signature. */
    @Transactional(readOnly = true)
    public String reason(UUID signatureId) {
        return signatureId == null ? null : repository.findById(signatureId).map(s -> s.getReason()).orElse(null);
    }

    /** The lines of the block of one signature (the Standard frame); empty when there is no such signature. */
    @Transactional(readOnly = true)
    public List<String> lines(UUID signatureId) {
        List<String> out = new ArrayList<>();
        if (signatureId == null) return out;
        repository.findById(signatureId).ifPresent(s -> {
            for (String line : signatures.renderSignatureBlock(s).split("\\R")) if (!line.isBlank()) out.add(line);
        });
        return out;
    }

    /** The font size of the block, in points (from the configuration). */
    public double fontPt() {
        Double pt = signatures.getDisplayFontSizePt();
        return pt == null ? 8.5 : pt;
    }
}

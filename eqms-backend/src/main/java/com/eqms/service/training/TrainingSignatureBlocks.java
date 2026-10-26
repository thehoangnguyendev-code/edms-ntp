package com.eqms.service.training;

import com.eqms.repository.ElectronicSignatureRepository;
import com.eqms.service.ElectronicSignatureService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * The electronic signature as it is written in a form: the block of the configuration of Electronic Signature (Settings): the name, "Electronically Signed", the time, the meaning, the reason and the
 * Signature ID, in the font size that the configuration gives. The text is the same as in the signed documents because it is made by the same renderer from the record of the signature.
 */
@Service
public class TrainingSignatureBlocks {
    private final ElectronicSignatureRepository repository;
    private final ElectronicSignatureService signatures;

    public TrainingSignatureBlocks(ElectronicSignatureRepository repository, ElectronicSignatureService signatures) {
        this.repository = repository;
        this.signatures = signatures;
    }

    /** The lines of the block of one signature; empty when there is no such signature. */
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

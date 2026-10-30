package com.eqms.service.training;

import com.eqms.repository.ElectronicSignatureRepository;
import com.eqms.service.ElectronicSignatureService;
import com.eqms.service.SignatureDisplayStyle;
import org.springframework.jdbc.core.JdbcTemplate;
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
    private final JdbcTemplate jdbc;

    public TrainingSignatureBlocks(ElectronicSignatureRepository repository, ElectronicSignatureService signatures, JdbcTemplate jdbc) {
        this.repository = repository;
        this.signatures = signatures;
        this.jdbc = jdbc;
    }

    /**
     * How the signature of a slot of a form of the Training Annex is shown: the style that Training Administration chose, else the compact style of the new electronic signature template
     * (owner decision 2026-10-29: forms made from now on use the new styles; a form made before keeps the text it was made with).
     */
    @Transactional(readOnly = true)
    public SignatureDisplayStyle style(String code, String slot) {
        return jdbc.queryForList("select style from training_annex_slot_styles where code = ? and slot = ?", String.class, code, slot).stream().findFirst().map(SignatureDisplayStyle::valueOf).orElse(SignatureDisplayStyle.COMPACT);
    }

    /** The lines of the block of one signature in the style chosen for the slot of the form. */
    @Transactional(readOnly = true)
    public List<String> lines(UUID signatureId, String code, String slot) {
        SignatureDisplayStyle style = style(code, slot);
        List<String> out = new ArrayList<>();
        if (signatureId == null) return out;
        repository.findById(signatureId).ifPresent(s -> {
            for (String line : signatures.renderSignatureBlock(s, style).split("\\R")) if (!line.isBlank()) out.add(line);
        });
        return out;
    }

    /** The lines of the block of one signature; empty when there is no such signature. */
    @Transactional(readOnly = true)
    public List<String> lines(UUID signatureId) {
        List<String> out = new ArrayList<>();
        if (signatureId == null) return out;
        repository.findById(signatureId).ifPresent(s -> {
            for (String line : signatures.renderSignatureBlock(s, SignatureDisplayStyle.COMPACT).split("\\R")) if (!line.isBlank()) out.add(line);
        });
        return out;
    }

    /** The font size of the block, in points (from the configuration). */
    public double fontPt() {
        Double pt = signatures.getDisplayFontSizePt();
        return pt == null ? 8.5 : pt;
    }
}

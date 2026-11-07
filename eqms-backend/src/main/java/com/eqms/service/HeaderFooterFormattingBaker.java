package com.eqms.service;

import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTFonts;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTHdrFtr;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTP;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTPPr;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTPPrBase;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTR;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTRPr;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTRow;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTSpacing;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTStyle;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTStyles;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTbl;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTc;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.STLineSpacingRule;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/**
 * A header/footer template is designed against its OWN document: a run that declares no font or size takes it from the
 * template's styles (the paragraph style, the Normal style, the document defaults). When the header/footer XML is moved
 * into the body document those styles are not moved with it, so the same text would take the body document's defaults
 * and no longer look like the Publishing Template. This writes the font, the size and the paragraph spacing the template's
 * styles give each run/paragraph into the copied XML, wherever the XML does not say them itself.
 */
final class HeaderFooterFormattingBaker {

    private static final String DEFAULT_PARAGRAPH_STYLE = "Normal";
    private static final int MAX_STYLE_CHAIN = 20;

    private final Map<String, CTStyle> stylesById = new HashMap<>();
    private final CTRPr defaultRun;
    private final CTPPrBase defaultParagraph;

    private HeaderFooterFormattingBaker(CTStyles templateStyles) {
        for (CTStyle style : templateStyles.getStyleList()) {
            if (style.getStyleId() != null) {
                stylesById.put(style.getStyleId(), style);
            }
        }
        var docDefaults = templateStyles.isSetDocDefaults() ? templateStyles.getDocDefaults() : null;
        defaultRun = docDefaults != null && docDefaults.isSetRPrDefault() && docDefaults.getRPrDefault().isSetRPr()
                ? docDefaults.getRPrDefault().getRPr() : null;
        defaultParagraph = docDefaults != null && docDefaults.isSetPPrDefault() && docDefaults.getPPrDefault().isSetPPr()
                ? docDefaults.getPPrDefault().getPPr() : null;
    }

    /** Writes the template's inherited formatting into {@code content}; a template without a styles part is left as it is. */
    static void bake(CTHdrFtr content, CTStyles templateStyles) {
        if (content == null || templateStyles == null) {
            return;
        }
        new HeaderFooterFormattingBaker(templateStyles).bakeContent(content.getPList(), content.getTblList());
    }

    private void bakeContent(List<CTP> paragraphs, List<CTTbl> tables) {
        for (CTP paragraph : paragraphs) {
            bakeParagraph(paragraph);
        }
        for (CTTbl table : tables) {
            for (CTRow row : table.getTrList()) {
                for (CTTc cell : row.getTcList()) {
                    bakeContent(cell.getPList(), cell.getTblList());
                }
            }
        }
    }

    private void bakeParagraph(CTP paragraph) {
        CTPPr directParagraph = paragraph.isSetPPr() ? paragraph.getPPr() : null;
        String paragraphStyleId = directParagraph != null && directParagraph.isSetPStyle()
                ? directParagraph.getPStyle().getVal()
                : DEFAULT_PARAGRAPH_STYLE;
        List<CTStyle> paragraphStyles = styleChain(paragraphStyleId);

        bakeSpacing(paragraph, directParagraph, paragraphStyles);

        for (CTR run : paragraph.getRList()) {
            List<CTRPr> chain = new ArrayList<>();
            if (run.isSetRPr()) {
                CTRPr direct = run.getRPr();
                chain.add(direct);
                if (direct.sizeOfRStyleArray() > 0) {
                    for (CTStyle style : styleChain(direct.getRStyleArray(0).getVal())) {
                        addIfPresent(chain, style.isSetRPr() ? style.getRPr() : null);
                    }
                }
            }
            for (CTStyle style : paragraphStyles) {
                addIfPresent(chain, style.isSetRPr() ? style.getRPr() : null);
            }
            addIfPresent(chain, defaultRun);
            bakeRun(run, chain);
        }
    }

    private void bakeRun(CTR run, List<CTRPr> chain) {
        String ascii = font(chain, CTFonts::getAscii, f -> f.isSetAsciiTheme());
        String hAnsi = font(chain, CTFonts::getHAnsi, f -> f.isSetHAnsiTheme());
        String eastAsia = font(chain, CTFonts::getEastAsia, f -> f.isSetEastAsiaTheme());
        String cs = font(chain, CTFonts::getCs, f -> f.isSetCstheme());
        Object size = firstSize(chain, false);
        Object sizeCs = firstSize(chain, true);
        if (ascii == null && hAnsi == null && eastAsia == null && cs == null && size == null && sizeCs == null) {
            return;
        }

        CTRPr target = run.isSetRPr() ? run.getRPr() : run.addNewRPr();
        if (ascii != null || hAnsi != null || eastAsia != null || cs != null) {
            CTFonts fonts = target.sizeOfRFontsArray() > 0 ? target.getRFontsArray(0) : target.addNewRFonts();
            if (ascii != null && fonts.getAscii() == null && !fonts.isSetAsciiTheme()) fonts.setAscii(ascii);
            if (hAnsi != null && fonts.getHAnsi() == null && !fonts.isSetHAnsiTheme()) fonts.setHAnsi(hAnsi);
            if (eastAsia != null && fonts.getEastAsia() == null && !fonts.isSetEastAsiaTheme()) fonts.setEastAsia(eastAsia);
            if (cs != null && fonts.getCs() == null && !fonts.isSetCstheme()) fonts.setCs(cs);
        }
        if (size != null && target.sizeOfSzArray() == 0) {
            target.addNewSz().setVal(size);
        }
        if (sizeCs != null && target.sizeOfSzCsArray() == 0) {
            target.addNewSzCs().setVal(sizeCs);
        }
    }

    /** The first level that names the font wins; a level that names it through a theme font is left alone. */
    private String font(List<CTRPr> chain, Function<CTFonts, String> value, Function<CTFonts, Boolean> theme) {
        for (CTRPr properties : chain) {
            if (properties.sizeOfRFontsArray() == 0) {
                continue;
            }
            CTFonts fonts = properties.getRFontsArray(0);
            String name = value.apply(fonts);
            if (name != null) {
                return name;
            }
            if (Boolean.TRUE.equals(theme.apply(fonts))) {
                return null;
            }
        }
        return null;
    }

    private Object firstSize(List<CTRPr> chain, boolean complexScript) {
        for (CTRPr properties : chain) {
            if (complexScript && properties.sizeOfSzCsArray() > 0) {
                return properties.getSzCsArray(0).getVal();
            }
            if (!complexScript && properties.sizeOfSzArray() > 0) {
                return properties.getSzArray(0).getVal();
            }
        }
        return null;
    }

    private void bakeSpacing(CTP paragraph, CTPPr direct, List<CTStyle> paragraphStyles) {
        List<CTSpacing> chain = new ArrayList<>();
        if (direct != null && direct.isSetSpacing()) {
            chain.add(direct.getSpacing());
        }
        for (CTStyle style : paragraphStyles) {
            if (style.isSetPPr() && style.getPPr().isSetSpacing()) {
                chain.add(style.getPPr().getSpacing());
            }
        }
        if (defaultParagraph != null && defaultParagraph.isSetSpacing()) {
            chain.add(defaultParagraph.getSpacing());
        }
        Object before = null;
        Object after = null;
        Object line = null;
        STLineSpacingRule.Enum lineRule = null;
        for (CTSpacing spacing : chain) {
            if (before == null && spacing.isSetBefore()) before = spacing.getBefore();
            if (after == null && spacing.isSetAfter()) after = spacing.getAfter();
            if (line == null && spacing.isSetLine()) line = spacing.getLine();
            if (lineRule == null && spacing.isSetLineRule()) lineRule = spacing.getLineRule();
        }
        if (before == null && after == null && line == null && lineRule == null) {
            return;
        }
        CTPPr target = paragraph.isSetPPr() ? paragraph.getPPr() : paragraph.addNewPPr();
        CTSpacing spacing = target.isSetSpacing() ? target.getSpacing() : target.addNewSpacing();
        if (before != null && !spacing.isSetBefore()) spacing.setBefore(before);
        if (after != null && !spacing.isSetAfter()) spacing.setAfter(after);
        if (line != null && !spacing.isSetLine()) spacing.setLine(line);
        if (lineRule != null && !spacing.isSetLineRule()) spacing.setLineRule(lineRule);
    }

    /** The style and the styles it is based on, nearest first. */
    private List<CTStyle> styleChain(String styleId) {
        List<CTStyle> chain = new ArrayList<>();
        String id = styleId;
        while (id != null && chain.size() < MAX_STYLE_CHAIN) {
            CTStyle style = stylesById.get(id);
            if (style == null) {
                break;
            }
            chain.add(style);
            id = style.isSetBasedOn() ? style.getBasedOn().getVal() : null;
        }
        return chain;
    }

    private static void addIfPresent(List<CTRPr> chain, CTRPr properties) {
        if (properties != null) {
            chain.add(properties);
        }
    }
}

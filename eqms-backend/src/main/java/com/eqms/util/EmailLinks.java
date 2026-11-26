package com.eqms.util;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.Node;
import org.jsoup.nodes.TextNode;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The addresses written into an e-mail. The application keeps them as paths ("/documents/{id}") because its own screens open them; in a mail such a path cannot be pressed (the cleaner of
 * the body even drops a link without a protocol) and it shows an internal identifier. For the mail only: the address variables are made complete with the public address of the application,
 * and where the body shows an address as text, it shows words that can be pressed instead. The variables the application stores and the in-app notification are not changed.
 */
public final class EmailLinks {
    private EmailLinks() {
    }

    private static final String PUBLIC_ADDRESS = "publicAppUrl";

    private static boolean isAddressName(String name) {
        return name != null && !PUBLIC_ADDRESS.equals(name) && (name.endsWith("Url") || name.endsWith("URL"));
    }

    /** A copy of the variables where every address that starts with "/" is made complete with the public address of the application. */
    public static Map<String, String> absolute(Map<String, String> variables, String publicAddress) {
        Map<String, String> out = new LinkedHashMap<>(variables == null ? Map.of() : variables);
        if (publicAddress == null || publicAddress.isBlank()) return out;
        String base = publicAddress.trim().replaceAll("/+$", "");
        out.replaceAll((name, value) -> isAddressName(name) && value != null && value.startsWith("/") && !value.startsWith("//") ? base + value : value);
        return out;
    }

    private static String wordsFor(String name) {
        return switch (name) {
            case "officeEditUrl" -> "Edit online";
            case "controlledCopyPreviewUrl" -> "View the controlled copy";
            default -> "Open in EQMS";
        };
    }

    /** The body with every address of the variables shown as words that can be pressed, never as the address itself. {@code variables} are the ones from {@link #absolute}. */
    public static String friendly(String html, Map<String, String> variables) {
        if (html == null || html.isBlank() || variables == null) return html;
        Map<String, String> addresses = new LinkedHashMap<>();
        variables.forEach((name, value) -> {
            if (isAddressName(name) && value != null && (value.startsWith("http://") || value.startsWith("https://"))) addresses.putIfAbsent(value, wordsFor(name));
        });
        if (addresses.isEmpty()) return html;
        // a mail already put in its frame is a whole document (head and styles stay); a body alone is a fragment
        boolean whole = html.regionMatches(true, 0, "<!doctype", 0, 9) || html.contains("<html");
        Document document = whole ? Jsoup.parse(html) : Jsoup.parseBodyFragment(html);
        document.outputSettings().prettyPrint(false);
        // longest first, so an address that begins with another one is not cut in two
        List<String> ordered = new ArrayList<>(addresses.keySet());
        ordered.sort((a, b) -> b.length() - a.length());
        for (Element link : document.select("a[href]")) {
            String words = addresses.get(link.attr("href"));
            if (words != null && link.text().trim().equals(link.attr("href"))) link.text(words);
        }
        for (String address : ordered) {
            for (Element element : document.body().getAllElements()) {
                if (element.tagName().equals("a") || element.parents().stream().anyMatch(p -> p.tagName().equals("a"))) continue;
                for (TextNode text : new ArrayList<>(element.textNodes())) {
                    link(text, address, addresses.get(address));
                }
            }
        }
        return whole ? document.outerHtml() : document.body().html();
    }

    private static void link(TextNode text, String address, String words) {
        String whole = text.getWholeText();
        int at = whole.indexOf(address);
        if (at < 0) return;
        List<Node> parts = new ArrayList<>();
        int from = 0;
        while (at >= 0) {
            if (at > from) parts.add(new TextNode(whole.substring(from, at)));
            parts.add(new Element("a").attr("href", address).text(words));
            from = at + address.length();
            at = whole.indexOf(address, from);
        }
        if (from < whole.length()) parts.add(new TextNode(whole.substring(from)));
        for (Node part : parts) text.before(part);
        text.remove();
    }
}

package ma.careplus.notification.application;

import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * Rendu de template ultra-simple : remplace les jetons {@code {{clef}}} par la
 * valeur du contexte. Jeton inconnu → chaîne vide (jamais de {{...}} résiduel).
 * Pas de moteur lourd (Thymeleaf réservé aux PDF) — un message reste court.
 */
@Component
public class TemplateRenderer {

    private static final Pattern TOKEN = Pattern.compile("\\{\\{\\s*(\\w+)\\s*}}");

    public String render(String template, Map<String, String> context) {
        if (template == null || template.isEmpty()) return "";
        Matcher m = TOKEN.matcher(template);
        StringBuilder out = new StringBuilder();
        while (m.find()) {
            String key = m.group(1);
            String value = context.getOrDefault(key, "");
            m.appendReplacement(out, Matcher.quoteReplacement(value));
        }
        m.appendTail(out);
        return out.toString();
    }
}

package ma.careplus.shared.pdf;

import java.awt.AlphaComposite;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * V043 — Pre-renders an image with alpha so it can be embedded into a PDF
 * watermark via openhtmltopdf.
 *
 * <p>openhtmltopdf 1.0.10 honours the CSS {@code opacity} property for text
 * and SVG, but ignores it on raster images embedded as {@code <img>} (the
 * underlying PDFBox image XObject is drawn opaque). The reliable workaround
 * is to bake the transparency into the pixel data ourselves : read the
 * upload, paint it onto a fresh ARGB canvas at the requested alpha, and
 * re-encode as PNG. The resulting bytes are still a valid PDF image and the
 * alpha channel is preserved end-to-end.
 *
 * <p>Stateless utility — single static entry point.
 */
public final class LogoWatermarkRenderer {

    private static final Logger log = LoggerFactory.getLogger(LogoWatermarkRenderer.class);

    /** Mime returned alongside the watermark bytes. Always PNG (alpha preserved). */
    public static final String WATERMARK_MIME = "image/png";

    private LogoWatermarkRenderer() {}

    /**
     * Returns a new PNG with the supplied alpha applied to every pixel.
     *
     * @param sourceBytes the raw upload (PNG, JPEG, etc.)
     * @param alpha       desired opacity, clamped to [0.0, 1.0]
     * @return PNG bytes, or {@code null} if the source can't be decoded
     */
    public static byte[] applyTransparency(byte[] sourceBytes, float alpha) {
        if (sourceBytes == null || sourceBytes.length == 0) return null;
        float a = Math.max(0f, Math.min(1f, alpha));
        try {
            BufferedImage src = ImageIO.read(new ByteArrayInputStream(sourceBytes));
            if (src == null) {
                log.warn("Logo watermark : ImageIO.read returned null — unsupported format");
                return null;
            }
            BufferedImage out = new BufferedImage(
                    src.getWidth(), src.getHeight(), BufferedImage.TYPE_INT_ARGB);
            Graphics2D g = out.createGraphics();
            try {
                g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, a));
                g.drawImage(src, 0, 0, null);
            } finally {
                g.dispose();
            }
            ByteArrayOutputStream sink = new ByteArrayOutputStream(sourceBytes.length);
            ImageIO.write(out, "png", sink);
            return sink.toByteArray();
        } catch (Exception e) {
            log.warn("Logo watermark : failed to apply transparency, falling back to opaque source", e);
            return null;
        }
    }
}

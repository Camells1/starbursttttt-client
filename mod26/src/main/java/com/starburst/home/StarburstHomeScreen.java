package com.starburst.home;

import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.multiplayer.JoinMultiplayerScreen;
import net.minecraft.client.gui.screens.options.OptionsScreen;
import net.minecraft.client.gui.screens.worldselection.SelectWorldScreen;
import net.minecraft.client.input.MouseButtonEvent;
import com.mojang.realmsclient.RealmsMainScreen;
import net.minecraft.network.chat.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Starbursttttt Client home screen: kinetic type on black, orange + purple accents, rounded shapes. */
public class StarburstHomeScreen extends Screen {
	private static final int INK = 0xFF070A1C;
	private static final int INK_2 = 0xFF0E1332;
	private static final int INK_3 = 0xFF1B2250;
	private static final int CREAM = 0xFFEEF1FF;
	private static final int DIM = 0xFF8A93C4;
	private static final int YELLOW = 0xFFFFD23F;
	private static final int PURPLE = 0xFF8B5CF6;
	private static final int BLUE = 0xFF3E86FF;

	private static final net.minecraft.network.chat.Style ROUND = net.minecraft.network.chat.Style.EMPTY.withFont(
			new net.minecraft.network.chat.FontDescription.Resource(net.minecraft.resources.Identifier.fromNamespaceAndPath("starburst-home", "round")));

	private static Component T(String s) {
		return Component.literal(s).setStyle(ROUND);
	}

	private static final String WORD = "Starbursttttt";

	private static final class Item {
		final String label;
		final Runnable action;
		float hover;
		float press;

		Item(String label, Runnable action) {
			this.label = label;
			this.action = action;
		}
	}

	private final List<Item> items = new ArrayList<>();
	private long openedAt;
	private long lastFrame;
	private boolean pendingClick;

	public StarburstHomeScreen() {
		super(Component.literal("Starbursttttt"));
	}

	@Override
	protected void init() {
		if (openedAt == 0) {
			openedAt = System.nanoTime();
			lastFrame = openedAt;
		}
		items.clear();
		Minecraft mc = Minecraft.getInstance();
		items.add(new Item("Singleplayer", () -> mc.gui.setScreen(new SelectWorldScreen(this))));
		items.add(new Item("Multiplayer", () -> mc.gui.setScreen(new JoinMultiplayerScreen(this))));
		items.add(new Item("Realms", () -> mc.gui.setScreen(new RealmsMainScreen(this))));
		if (FabricLoader.getInstance().isModLoaded("modmenu")) {
			items.add(new Item("Mods", this::openModMenu));
		}
		items.add(new Item("Options", () -> mc.gui.setScreen(new OptionsScreen(this, mc.options, false))));
		items.add(new Item("Quit", mc::stop));
	}

	private void openModMenu() {
		try {
			Class<?> c = Class.forName("com.terraformersmc.modmenu.gui.ModsScreen");
			Object s = c.getConstructor(Screen.class).newInstance(this);
			Minecraft.getInstance().gui.setScreen((Screen) s);
		} catch (Throwable ignored) {
		}
	}

	@Override
	public boolean mouseClicked(MouseButtonEvent event, boolean doubleClick) {
		if (event.button() == 0) pendingClick = true;
		return true;
	}

	@Override
	public boolean shouldCloseOnEsc() {
		return false;
	}

	@Override
	public boolean isPauseScreen() {
		return false;
	}

	@Override
	public void extractBackground(GuiGraphicsExtractor ctx, int mouseX, int mouseY, float delta) {
		// drawn manually in render(); suppress vanilla blur/panorama
	}

	// ------------------------------------------------------------------ helpers

	private static float clamp(float v) {
		return v < 0f ? 0f : (v > 1f ? 1f : v);
	}

	private static float outBack(float t) {
		float c1 = 1.9f;
		float c3 = c1 + 1f;
		float p = t - 1f;
		return 1f + c3 * p * p * p + c1 * p * p;
	}

	private static float outCubic(float t) {
		float p = 1f - t;
		return 1f - p * p * p;
	}

	private static int mix(int a, int b, float t) {
		t = clamp(t);
		int ar = a >> 16 & 255, ag = a >> 8 & 255, ab = a & 255;
		int br = b >> 16 & 255, bg = b >> 8 & 255, bb = b & 255;
		return 0xFF000000 | ((int) (ar + (br - ar) * t) << 16) | ((int) (ag + (bg - ag) * t) << 8) | (int) (ab + (bb - ab) * t);
	}

	private static int alpha(int c, float a) {
		return ((int) (clamp(a) * 255) << 24) | (c & 0xFFFFFF);
	}

	/** Filled rounded rectangle built from per-row insets. */
	private static void rrect(GuiGraphicsExtractor ctx, int x, int y, int w, int h, int r, int color) {
		if (w <= 0 || h <= 0) return;
		r = Math.min(r, Math.min(w, h) / 2);
		for (int i = 0; i < r; i++) {
			double dy = r - i - 0.5;
			int inset = r - (int) Math.round(Math.sqrt((double) r * r - dy * dy));
			ctx.fill(x + inset, y + i, x + w - inset, y + i + 1, color);
			ctx.fill(x + inset, y + h - 1 - i, x + w - inset, y + h - i, color);
		}
		ctx.fill(x, y + r, x + w, y + h - r, color);
	}

	/** One glyph run, centred horizontally on its advance, sitting on baselineY, squashed about the baseline. */
	private void glyph(GuiGraphicsExtractor ctx, Font tr, String s, float x, float baseY, int size,
					   float sx, float sy, int color) {
		float w = tr.width(T(s));
		var m = ctx.pose();
		m.pushMatrix();
		m.translate(x + w * size / 2f, baseY);
		m.scale(size * sx, size * sy);
		ctx.text(tr, T(s), Math.round(-w / 2f), -8, color, false);
		m.popMatrix();
	}

	private void wordmark(GuiGraphicsExtractor ctx, Font tr, float t, int mx, int my, int x, int baseY, int size) {
		int cursor = x;
		int n = WORD.length();
		float wavePos = ((t * 0.55f) % 5.0f) * 1.6f - 0.8f;
		for (int i = 0; i < n; i++) {
			String ch = String.valueOf(WORD.charAt(i));
			int cw = tr.width(T(ch)) * size;
			// +1 font px of tracking so squashed neighbours never touch
			int adv = cw + size;
			float centre = cursor + cw / 2f;

			float start = 0.15f + i * 0.07f;
			float local = clamp((t - start) / 0.75f);
			float yOff = -(1f - outBack(local)) * 150f;
			float sy = 1f;
			float sx = 1f;
			if (local < 1f) {
				float stretch = 1f + (1f - local) * 0.4f;
				sy = stretch;
				sx = 1f / stretch;
			}
			float since = t - (start + 0.75f);
			if (since > 0f && since < 0.6f) {
				float k = (float) Math.exp(-since * 7f) * (float) Math.cos(since * 22f);
				sy = 1f - 0.2f * k;
				sx = 1f + 0.1f * k;
			}
			float u = i / (float) (n - 1);
			float d = Math.abs(u - wavePos);
			if (d < 0.22f && t > 1.6f) {
				float k = (float) Math.cos(d / 0.22f * Math.PI / 2);
				sy *= 1f - 0.16f * k;
				sx *= 1f + 0.06f * k;
			}
			float dm = Math.abs(mx - centre);
			if (my < baseY + 8 && my > baseY - size * 9 - 10 && dm < size * 16f) {
				float k = 1f - dm / (size * 16f);
				sy *= 1f - 0.26f * k * k;
				sx *= 1f + 0.08f * k * k;
			}
			if (local > 0f) {
				int col = (i % 3 == 0) ? BLUE : (i % 3 == 1 ? CREAM : PURPLE);
				if (i >= n - 4) col = YELLOW;
				glyph(ctx, tr, ch, cursor, baseY + yOff, size, sx, sy, col);
			}
			cursor += adv;
		}
	}

	private void background(GuiGraphicsExtractor ctx, float t) {
		ctx.fill(0, 0, width, height, INK);
		// soft drifting nebula slabs, blue and purple
		for (int i = 0; i < 4; i++) {
			float ph = t * (0.1f + i * 0.035f) + i * 1.9f;
			float bw = 150 + 80 * (float) Math.sin(ph * 1.2f + i);
			float bh = 100 - 50 * (float) Math.sin(ph * 1.2f + i);
			float cx = width * (0.15f + 0.23f * i) + 40 * (float) Math.sin(ph);
			float cy = height * (0.35f + 0.25f * (float) Math.cos(ph * 0.8f + i));
			int tint = (i % 2 == 0) ? BLUE : PURPLE;
			rrect(ctx, (int) (cx - bw / 2), (int) (cy - bh / 2), (int) bw, (int) bh, (int) Math.min(bw, bh) / 2, mix(INK, tint, 0.16f));
		}
		// twinkling stars on a fixed hash grid, drifting left
		int count = Math.max(40, width * height / 2600);
		for (int i = 0; i < count; i++) {
			int h = i * 0x9E3779B1;
			h ^= h >>> 15;
			float fx = ((h & 0xFFFF) / 65535f);
			float fy = (((h >>> 16) & 0xFFFF) / 65535f);
			float z = 0.3f + ((i * 37) % 70) / 100f;
			float x = ((fx * width - t * 6f * z) % width + width) % width;
			float y = fy * height;
			float tw = 0.5f + 0.5f * (float) Math.sin(t * (1.2f + (i % 5) * 0.4f) + i);
			int c = (i % 5 == 0) ? YELLOW : (i % 3 == 0 ? PURPLE : (i % 2 == 0 ? BLUE : CREAM));
			int sz = z > 0.85f ? 2 : 1;
			ctx.fill((int) x, (int) y, (int) x + sz, (int) y + sz, alpha(c, 0.25f + 0.75f * tw * z));
		}
		// a starburst pops somewhere every couple of seconds
		float cycle = t / 2.2f;
		int k = (int) cycle;
		float p = cycle - k;
		int bh2 = (k * 0x45D9F3B) ^ (k >>> 3);
		float bx = ((bh2 & 0xFFF) / 4095f) * (width - 40) + 20;
		float by = (((bh2 >>> 12) & 0xFFF) / 4095f) * (height - 60) + 20;
		float e = 1f - (1f - clamp(p * 1.8f)) * (1f - clamp(p * 1.8f));
		float a = p < 0.3f ? p / 0.3f : 1f - (p - 0.3f) / 0.7f;
		int r = (int) (4 + 14 * e);
		int col = (k % 2 == 0) ? YELLOW : CREAM;
		ctx.fill((int) bx - r, (int) by, (int) bx + r + 1, (int) by + 1, alpha(col, a));
		ctx.fill((int) bx, (int) by - r, (int) bx + 1, (int) by + r + 1, alpha(col, a));
		int d = r / 2;
		ctx.fill((int) bx - d, (int) by - d, (int) bx - d + 1, (int) by - d + 1, alpha(col, a * 0.8f));
		ctx.fill((int) bx + d, (int) by - d, (int) bx + d + 1, (int) by - d + 1, alpha(col, a * 0.8f));
		ctx.fill((int) bx - d, (int) by + d, (int) bx - d + 1, (int) by + d + 1, alpha(col, a * 0.8f));
		ctx.fill((int) bx + d, (int) by + d, (int) bx + d + 1, (int) by + d + 1, alpha(col, a * 0.8f));
	}

	@Override
	public void extractRenderState(GuiGraphicsExtractor ctx, int mouseX, int mouseY, float delta) {
		Minecraft mc = Minecraft.getInstance();
		Font tr = mc.font;
		long now = System.nanoTime();
		float t = (now - openedAt) / 1_000_000_000f;
		float dt = Math.min(0.1f, (now - lastFrame) / 1_000_000_000f);
		lastFrame = now;

		int mx = mouseX;
		int my = mouseY;
		boolean clicked = pendingClick;
		pendingClick = false;

		background(ctx, t);

		int pad = Math.max(20, width / 24);
		int wmSize = Math.max(2, Math.min(8, width / 110));
		int wordPx = tr.width(T(WORD));
		while (wmSize > 2 && (wordPx + WORD.length()) * wmSize > width - pad * 2) wmSize--;
		int wmBase = pad + wmSize * 9;
		wordmark(ctx, tr, t, mx, my, pad, wmBase, wmSize);

		float tl = outCubic(clamp((t - 1.1f) / 0.6f));
		String tag = "MINECRAFT " + net.minecraft.SharedConstants.getCurrentVersion().name() + "  /  FABRIC  /  "
				+ FabricLoader.getInstance().getAllMods().size() + " MODS";
		ctx.text(tr, T(tag), pad + (int) ((1f - tl) * -40), wmBase + 12, alpha(DIM, tl), false);

		// menu: row height adapts to the space left so rows never overlap
		int menuY = wmBase + 12 + 9 + 14;
		int avail = height - menuY - 34;
		int rowH = Math.max(15, Math.min(32, avail / items.size()));
		int textSize = rowH >= 29 ? 2 : 1;
		int menuW = Math.min(width - pad * 2, 260);
		int gap = 3;
		for (int i = 0; i < items.size(); i++) {
			Item it = items.get(i);
			float appear = outCubic(clamp((t - 1.0f - i * 0.08f) / 0.55f));
			int y = menuY + i * rowH;
			int bh = rowH - gap;
			boolean over = appear > 0.95f && mx >= pad && mx < pad + menuW && my >= y && my < y + bh;
			it.hover += ((over ? 1f : 0f) - it.hover) * Math.min(1f, dt * 16f);
			it.press = Math.max(0f, it.press - dt * 4f);
			if (over && clicked) {
				it.press = 1f;
				it.action.run();
				return;
			}
			if (appear <= 0f) continue;

			int ox = (int) ((1f - appear) * -60f);
			float hv = it.hover;
			int r = bh / 2;
			rrect(ctx, pad + ox, y, menuW, bh, r, INK_2);
			int barW = Math.max(0, (int) (menuW * hv));
			if (barW > r) {
				rrect(ctx, pad + ox, y, barW, bh, r, YELLOW);
			}

			String idx = String.format(Locale.ROOT, "%02d", i + 1);
			int idxY = y + (bh - 8) / 2;
			ctx.text(tr, T(idx), pad + ox + r + 2, idxY, mix(DIM, INK, hv), false);

			String label = it.label;
			int lx = pad + ox + r + 2 + tr.width(T("00")) + 10 + (int) (hv * 6f);
			float top = y + (bh - 8f * textSize) / 2f;
			float base = top + 8f * textSize;
			int cur = lx;
			for (int c = 0; c < label.length(); c++) {
				String ch = String.valueOf(label.charAt(c));
				int cw = tr.width(T(ch)) * textSize;
				float rip = (float) Math.sin(t * 9f - c * 0.7f) * 1.2f * hv;
				float sq = 1f - 0.12f * it.press;
				glyph(ctx, tr, ch, cur, base + Math.round(rip), textSize, 1f + 0.08f * it.press, sq, mix(CREAM, INK, hv));
				cur += cw + textSize;
			}
		}

		String who = mc.getUser().getName();
		ctx.text(tr, T(who.toUpperCase(Locale.ROOT)), pad, height - 22, CREAM, false);
		ctx.text(tr, T("STARBURSTTTTT CLIENT"), pad, height - 12, PURPLE, false);
	}
}

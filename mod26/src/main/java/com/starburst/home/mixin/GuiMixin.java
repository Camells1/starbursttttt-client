package com.starburst.home.mixin;

import com.starburst.home.StarburstHomeScreen;
import net.minecraft.client.gui.Gui;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.TitleScreen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

@Mixin(Gui.class)
public abstract class GuiMixin {
	@ModifyVariable(method = "setScreen", at = @At("HEAD"), argsOnly = true)
	private Screen starburst$swapTitle(Screen screen) {
		if (screen != null && screen.getClass() == TitleScreen.class) {
			return new StarburstHomeScreen();
		}
		return screen;
	}
}

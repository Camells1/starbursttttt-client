package com.starburst.home.mixin;

import com.starburst.home.StarburstHomeScreen;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.screen.TitleScreen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

@Mixin(MinecraftClient.class)
public abstract class MinecraftClientMixin {
	@ModifyVariable(method = "setScreen", at = @At("HEAD"), argsOnly = true)
	private Screen starburst$swapTitle(Screen screen) {
		if (screen != null && screen.getClass() == TitleScreen.class) {
			return new StarburstHomeScreen();
		}
		return screen;
	}
}

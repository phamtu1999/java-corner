package org.recompile.freej2me;

import org.recompile.mobile.Mobile;
import pl.zb3.freej2me.bridge.shell.KeyEvent;

/** Deliver text on the platform event queue without telephone key mappings. */
public final class TextInput {
    public static void send(int code, char character) {
        KeyEvent event = new KeyEvent(code, character, false, false);
        event.platformCode = code;
        event.normalizedCode = code;
        Mobile.getPlatform().keyPressed(event);
        Mobile.getPlatform().keyReleased(event);
    }
}

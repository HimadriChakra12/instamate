    const Float = {
        isFloatWindow:
            window.name.startsWith('float:'),
        button: null,
        windows: new Map(),
        windowPrefix: 'float:',

        init() {
            if (this.isFloatWindow) {
                this.initFloatWindow();
                return;
            }
            this.initMainWindow();
        },


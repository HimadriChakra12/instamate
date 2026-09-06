// Injects the CSS that hides Instagram's sidebar/chrome inside the
    // float window. These are Instagram's own generated class names, so
    // they'll drift whenever Instagram ships a redesign -- there's no way
    // around hardcoding them short of Instagram exposing stable hooks.
    Float.installFloatStyles = function installFloatStyles() {
        if (document.getElementById('float-addon-style')) return;

        const style = document.createElement('style');
        style.id = 'float-addon-style';
        style.textContent = `
            div[class="x9f619 x2lah0s x1nhvcw1 x1qjc9v5 xozqiw3 x1q0g3np x78zum5 x1iyjqo2 x5yr21d x1t2pt76 x1n2onr6 x1ja2u2z x1k6qp8s"] {
                height: 100vh !important;
            }
            .x132t2bv {
                padding-inline-start: 0 !important;
            }
            div[class="x1qjc9v5 x972fbf x10w94by x1qhh985 x14e42zd x9f619 x78zum5 xdt5ytf x1iyjqo2 x5wqa0o xln7xf2 xk390pu xdj266r x14z9mp xat24cr x1lziwak x65f84u x1vq45kp xexx8yu xyri2b x18d9i69 x1c1uobl x1n2onr6 x11njtxf"],
            div[class="_aasi _aask _at8n"],
            div[class="x78zum5 x1q0g3np x1gslohp xwib8y2 x1yrsyyn"],
            section[class="x1qjc9v5 x972fbf x10w94by x1qhh985 x14e42zd x9f619 x78zum5 xdt5ytf x1iyjqo2 x5wqa0o xln7xf2 xk390pu xdj266r x14z9mp xat24cr x1lziwak x65f84u x1vq45kp xexx8yu xyri2b x18d9i69 x1c1uobl x1n2onr6 x11njtxf"],
            section[class="x78zum5 x1q0g3np x1gslohp xwib8y2 x1yrsyyn"],
            div[class="x78zum5 xdt5ytf x1iyjqo2 xs83m0k x2lwn1j xw2csxc x1odjw0f x1n2onr6 x12nagc"],
            div[class="x1yztbdb"],
            .x1n327nk.xeq5yr9.x1dr59a3.x1nhvcw1.x1oa3qoh.x1qjc9v5.xqjyukv.xdt5ytf.x2lah0s.x1c4vz4f.xryxfnj.x1plvlek.x13vifvy.xixxii4.xbiv7yw.x16uus16.x1ga7v0g.x15mokao.x78zum5.xjbqb8w.x9f619,
            .xvbhtw8.xf7dkkf.xv54qhq.x11njtxf.x1n2onr6.x18d9i69.xexx8yu.x1h3rv7z.x1lziwak.xat24cr.x14z9mp.xdj266r.xk390pu.x2lah0s.xdt5ytf.x78zum5.x9f619.x1qjc9v5,
            div[class="x1n2onr6 x1ja2u2z x78zum5 xdt5ytf xuphzoz xt5vzds x17quhge x1wggrwl x1u1lrf5 xvbhtw8"],
            div[class="x1qjc9v5 x78zum5 x1q0g3np xl56j7k xh8yej3"],
            div[class="html-div xdj266r x14z9mp xat24cr x1lziwak xexx8yu xyri2b x18d9i69 x1c1uobl x9f619 xjbqb8w x78zum5 x15mokao x1ga7v0g x16uus16 xbiv7yw xixxii4 x1ey2m1c x1plvlek xryxfnj x1c4vz4f x2lah0s xdt5ytf xqjyukv x1qjc9v5 x1oa3qoh x1nhvcw1 xg7h5cd xh8yej3 xhtitgo x6w1myc x1jeouym"] {
                display: none;
            }
        `;
        document.head.appendChild(style);
    };

    // Hides Instagram's nav and message composer inside the float window --
    // walks up from the composer textarea rather than hardcoding a
    // container class, stopping if a "container" gets suspiciously tall
    // (150px) so it can't accidentally swallow the whole conversation.
    Float.applyFloatLayout = function applyFloatLayout() {
        if (!this.isFloatWindow) return;

        document.querySelectorAll('nav').forEach((nav) => {
            nav.style.setProperty('display', 'none', 'important');
        });

        const textarea = document.querySelector('textarea[placeholder="Message..."]');
        if (!textarea) return;

        textarea.style.setProperty('display', 'none', 'important');

        let parent = textarea.parentElement;
        for (let i = 0; i < 6 && parent; i++) {
            if (parent.getBoundingClientRect().height > 150) break;
            parent.style.setProperty('display', 'none', 'important');
            parent = parent.parentElement;
        }
    };

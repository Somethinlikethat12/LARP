'use strict';

/** Main menu: start the single-player journey, or host / join an online duel. */
(() => {
    const $ = id => document.getElementById(id);
    const menu = $('menu'), canvas = $('game');
    const PANELS = ['menu-main', 'menu-host', 'menu-join'];
    let link = null;
    let joinTimer = 0;

    const myLook = (() => {
        const lo = new Loadout();
        lo.load();
        return Object.assign({}, lo.look);
    })();

    const show = id => {
        for (const p of PANELS) $(p).hidden = p !== id;
    };
    const setStatus = (id, msg, bad) => {
        $(id).textContent = msg;
        $(id).classList.toggle('bad', !!bad);
    };
    const dropLink = () => {
        clearTimeout(joinTimer);
        if (link !== null) link.close();
        link = null;
    };
    const back = () => {
        dropLink();
        history.replaceState(null, '', location.href.split(/[?#]/)[0]);
        show('menu-main');
    };
    const startDuel = (l, localIdx, delay, looks) => {
        clearTimeout(joinTimer);
        menu.hidden = true;
        canvas.focus();
        new Duel(canvas, l, localIdx, delay, looks).run();
    };
    const inviteUrl = code => location.href.split(/[?#]/)[0] + '?join=' + code;
    const netMissing = () => !DuelLink.available();

    $('btn-journey').textContent = SaveGame.read() !== null ? 'Continue Journey' : 'Begin Journey';
    $('btn-journey').onclick = () => {
        menu.hidden = true;
        canvas.focus();
        startJourney(canvas);
    };
    for (const b of document.querySelectorAll('#menu .back')) b.onclick = back;

    // ---------------- host ----------------
    $('btn-host').onclick = () => {
        show('menu-host');
        $('host-code').textContent = '------';
        $('host-link').value = '';
        $('btn-copy').disabled = true;
        if (netMissing()) {
            setStatus('host-status', 'Online play needs an internet connection (PeerJS failed to load).', true);
            return;
        }
        setStatus('host-status', 'Creating room...');
        const l = link = new DuelLink();
        l.host(code => {
            if (link !== l) return;
            $('host-code').textContent = code;
            $('host-link').value = inviteUrl(code);
            $('btn-copy').disabled = false;
            setStatus('host-status', 'Waiting for an opponent... send them the invite link or the room code.');
        }, e => {
            if (link === l) setStatus('host-status', DuelLink.errorText(e), true);
        });
        l.on('hello', d => {
            if (link !== l) return;
            if (d.v !== NET_VERSION) {
                l.send({ t: 'reject', why: 'Version mismatch - both players need the same version of the game.' });
                setStatus('host-status', 'Your opponent is running a different version of the game.', true);
                return;
            }
            setStatus('host-status', 'Opponent found! Measuring the connection...');
            // give the ping exchange a moment so the input delay fits the connection
            setTimeout(() => {
                if (link !== l || l.closed) return;
                const delay = inputDelayFor(l.ping());
                const looks = [myLook, d.look];
                l.send({ t: 'start', delay, looks });
                link = null;
                startDuel(l, 0, delay, looks);
            }, 1500);
        });
        l.onClose = () => {
            if (link === l) setStatus('host-status', 'Your opponent disconnected. Go back and host again.', true);
        };
    };

    $('btn-copy').onclick = () => {
        const url = $('host-link').value;
        if (!url) return;
        const done = () => setStatus('host-status', 'Invite link copied! Waiting for an opponent...');
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => {
            $('host-link').select();
            document.execCommand('copy');
            done();
        });
        else {
            $('host-link').select();
            document.execCommand('copy');
            done();
        }
    };

    // ---------------- join ----------------
    const join = () => {
        const code = DuelLink.cleanCode($('join-code').value);
        $('join-code').value = code;
        if (code.length < 4) {
            setStatus('join-status', 'Enter the room code your host gave you.', true);
            return;
        }
        if (netMissing()) {
            setStatus('join-status', 'Online play needs an internet connection (PeerJS failed to load).', true);
            return;
        }
        dropLink();
        setStatus('join-status', 'Connecting...');
        const l = link = new DuelLink();
        joinTimer = setTimeout(() => {
            if (link === l && !(l.conn && l.conn.open)) {
                dropLink();
                setStatus('join-status', 'Could not reach that duel. Check the code and try again.', true);
            }
        }, 15000);
        l.join(code, e => {
            if (link !== l) return;
            dropLink();
            setStatus('join-status', DuelLink.errorText(e), true);
        });
        l.onOpen = () => {
            if (link !== l) return;
            setStatus('join-status', 'Connected! Waiting for the host...');
            l.send({ t: 'hello', v: NET_VERSION, look: myLook });
        };
        l.on('full', () => {
            if (link !== l) return;
            dropLink();
            setStatus('join-status', 'That duel already has two swordsmen.', true);
        });
        l.on('reject', d => {
            if (link !== l) return;
            dropLink();
            setStatus('join-status', typeof d.why === 'string' ? d.why.slice(0, 120) : 'The host rejected the connection.', true);
        });
        l.on('start', d => {
            if (link !== l) return;
            link = null;
            const delay = Number.isInteger(d.delay) ? U.clamp(d.delay, 3, 8) : 4;
            const hostLook = Array.isArray(d.looks) ? d.looks[0] : null;
            startDuel(l, 1, delay, [hostLook, myLook]);
        });
        l.onClose = () => {
            if (link === l) {
                link = null;
                setStatus('join-status', 'The host closed the connection.', true);
            }
        };
    };

    $('btn-join').onclick = () => {
        show('menu-join');
        setStatus('join-status', '');
        $('join-code').focus();
    };
    $('btn-join-go').onclick = join;
    $('join-code').addEventListener('keydown', e => {
        if (e.key === 'Enter') join();
    });

    // invite links open straight into the join screen
    const invite = new URLSearchParams(location.search).get('join');
    if (invite) {
        show('menu-join');
        $('join-code').value = DuelLink.cleanCode(invite);
        join();
    } else show('menu-main');
})();

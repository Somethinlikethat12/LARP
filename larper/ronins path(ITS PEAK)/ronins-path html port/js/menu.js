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
    const startDuel = (l, localIdx, delay, looks, settings) => {
        clearTimeout(joinTimer);
        menu.hidden = true;
        canvas.focus();
        new Duel(canvas, l, localIdx, delay, looks, settings).run();
    };
    const inviteUrl = code => location.href.split(/[?#]/)[0] + '?join=' + code;
    const netMissing = () => !DuelLink.available();
    // only keep the appearance fields we know, whatever a peer sends
    const cleanLook = look => {
        const lo = new Loadout();
        lo.apply({ look }, 0);
        return Object.assign({}, lo.look);
    };

    $('btn-journey').textContent = SaveGame.read() !== null ? 'Continue Journey' : 'Begin Journey';
    $('btn-journey').onclick = () => {
        menu.hidden = true;
        canvas.focus();
        startJourney(canvas);
    };
    for (const b of document.querySelectorAll('#menu .back')) b.onclick = back;

    // ---------------- host ----------------
    let hostSettings = null;
    let lobby = [];
    let refreshLobby = () => {};
    const readSettings = () => sanitizeSettings({
        mode: $('set-mode').value,
        maxPlayers: parseInt($('set-max').value, 10),
        rounds: parseInt($('set-rounds').value, 10),
        hp: parseInt($('set-hp').value, 10),
        gourds: parseInt($('set-gourds').value, 10),
        arena: $('set-arena').value,
        stab: $('set-stab').value !== 'off',
    });
    const onSettingsChanged = () => {
        $('set-max').disabled = $('set-mode').value !== 'ffa';
        hostSettings = readSettings();
        refreshLobby();
    };
    $('set-mode').onchange = () => {
        // a crowd needs room to move
        $('set-arena').value = $('set-mode').value === 'ffa' ? 'large' : 'medium';
        onSettingsChanged();
    };
    for (const id of ['set-max', 'set-rounds', 'set-hp', 'set-gourds', 'set-arena', 'set-stab']) $(id).onchange = onSettingsChanged;

    $('btn-host').onclick = () => {
        show('menu-host');
        $('host-code').textContent = '------';
        $('host-link').value = '';
        $('host-players').textContent = '';
        $('btn-copy').disabled = true;
        $('btn-start').disabled = true;
        lobby = [];
        onSettingsChanged();
        if (netMissing()) {
            setStatus('host-status', 'Online play needs an internet connection (PeerJS failed to load).', true);
            return;
        }
        setStatus('host-status', 'Creating room...');
        const l = link = new DuelLink();
        let open = false;
        refreshLobby = () => {
            if (link !== l || !open) return;
            const s = hostSettings, count = lobby.length + 1, tooMany = count > s.maxPlayers;
            $('host-players').textContent = 'Players: ' + count + ' / ' + s.maxPlayers;
            $('btn-start').disabled = lobby.length === 0 || tooMany;
            if (tooMany) setStatus('host-status', 'Too many players for these settings - raise the max or switch to Free-for-all.', true);
            else if (lobby.length === 0) setStatus('host-status', 'Waiting for players... send them the invite link or the room code.');
            else if (s.mode === 'duel') setStatus('host-status', 'Opponent found! Press Start Match when ready.');
            else setStatus('host-status', 'Press Start Match once everyone is in.');
            for (const c of lobby) c.send({ t: 'lobby', n: count, s });
        };
        l.accept = n => n < hostSettings.maxPlayers - 1;
        l.host(code => {
            if (link !== l) return;
            open = true;
            $('host-code').textContent = code;
            $('host-link').value = inviteUrl(code);
            $('btn-copy').disabled = false;
            refreshLobby();
        }, e => {
            if (link === l) setStatus('host-status', DuelLink.errorText(e), true);
        });
        const refuse = (c, msg) => {
            c.send(msg);
            setTimeout(() => l.drop(c), 300);
        };
        l.on('hello', (d, c) => {
            if (link !== l || lobby.includes(c)) return;
            if (d.v !== NET_VERSION) {
                refuse(c, { t: 'reject', why: 'Version mismatch - everyone needs the same version of the game.' });
                return;
            }
            if (lobby.length + 1 >= hostSettings.maxPlayers) {
                refuse(c, { t: 'full' });
                return;
            }
            c.look = cleanLook(d.look);
            lobby.push(c);
            refreshLobby();
        });
        l.onPeerClose = c => {
            if (link !== l) return;
            lobby = lobby.filter(x => x !== c);
            refreshLobby();
        };
    };

    $('btn-start').onclick = () => {
        const l = link;
        if (l === null || l.role !== 'host' || lobby.length === 0) return;
        const s = hostSettings;
        if (lobby.length + 1 > s.maxPlayers) return;
        l.accept = () => false;
        for (const c of l.conns.slice()) {
            if (!lobby.includes(c)) {
                c.send({ t: 'full' });
                setTimeout(() => l.drop(c), 300);
            }
        }
        lobby.forEach((c, k) => { c.idx = k + 1; });
        // a relayed input crosses two links, so budget for the two slowest
        const rtts = lobby.map(c => c.ping()).sort((a, b) => b - a);
        const delay = inputDelayFor((rtts[0] || 0) + (rtts[1] || 0));
        const looks = [myLook].concat(lobby.map(c => c.look));
        for (const c of lobby) c.send({ t: 'start', delay, looks, you: c.idx, s });
        link = null;
        startDuel(l, 0, delay, looks, s);
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
        $('join-lobby').textContent = '';
        setStatus('join-status', 'Connecting...');
        const l = link = new DuelLink();
        joinTimer = setTimeout(() => {
            if (link === l && !l.connected) {
                dropLink();
                setStatus('join-status', 'Could not reach that match. Check the code and try again.', true);
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
            setStatus('join-status', 'That match is full or has already started.', true);
        });
        l.on('reject', d => {
            if (link !== l) return;
            dropLink();
            setStatus('join-status', typeof d.why === 'string' ? d.why.slice(0, 120) : 'The host rejected the connection.', true);
        });
        l.on('lobby', d => {
            if (link !== l) return;
            const s = sanitizeSettings(d.s), n = Number.isInteger(d.n) ? U.clamp(d.n, 1, MAX_FFA_PLAYERS) : 1;
            setStatus('join-status', 'Connected! Waiting for the host to start  (' + n + ' / ' + s.maxPlayers + ' players)');
            $('join-lobby').textContent = describeSettings(s);
        });
        l.on('start', d => {
            if (link !== l) return;
            const n = Array.isArray(d.looks) ? d.looks.length : 0, you = d.you;
            if (n < 2 || n > MAX_FFA_PLAYERS || !Number.isInteger(you) || you < 1 || you >= n) {
                dropLink();
                setStatus('join-status', 'The host sent an invalid match setup.', true);
                return;
            }
            link = null;
            const delay = Number.isInteger(d.delay) ? U.clamp(d.delay, 3, 10) : 4;
            const looks = d.looks.map(cleanLook);
            looks[you] = myLook;
            startDuel(l, you, delay, looks, sanitizeSettings(d.s));
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

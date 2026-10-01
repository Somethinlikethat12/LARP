'use strict';

/** Main menu: start the single-player journey, or host / join an online duel. */
(() => {
    const $ = id => document.getElementById(id);
    const menu = $('menu'), canvas = $('game');
    const PANELS = ['menu-main', 'menu-host', 'menu-join'];
    let link = null;
    let joinTimer = 0;
    let coopMode = false;

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
    const startCoop = (l, host, save, hostGame) => {
        clearTimeout(joinTimer);
        menu.hidden = true;
        canvas.focus();
        const game = hostGame || new Game(save.seed, canvas, save);
        if (!host) {
            game.guestJourney = true;
            game.player.x += 45;
            game.world.resolve(game.player);
            game.camX = game.player.x;
            game.camY = game.player.y;
        }
        new Coop(game, l, host);
        game.note(host ? 'Friend joined your journey' : 'Joined host journey (guest progress is not saved)', true);
        window.addEventListener('pagehide', () => l.close(), { once: true });
        game.run();
    };
    const inviteUrl = code => location.href.split(/[?#]/)[0] + (coopMode ? '?coop=' : '?join=') + code;
    const netMissing = () => !DuelLink.available();

    $('btn-journey').textContent = SaveGame.read() !== null ? 'Continue Journey' : 'Begin Journey';
    $('btn-journey').onclick = () => {
        menu.hidden = true;
        canvas.focus();
        startJourney(canvas);
    };
    for (const b of document.querySelectorAll('#menu .back')) b.onclick = back;

    // ---------------- host ----------------
    const host = isCoop => {
        coopMode = isCoop;
        show('menu-host');
        $('menu-host').querySelector('h2').textContent = isCoop ? 'Host a Co-op Journey' : 'Host a Duel';
        $('host-code').textContent = '------';
        $('host-link').value = '';
        $('btn-copy').disabled = true;
        if (netMissing()) {
            setStatus('host-status', 'Online play needs an internet connection (PeerJS failed to load).', true);
            return;
        }
        setStatus('host-status', 'Creating room...');
        const l = link = new DuelLink(isCoop ? 'RONINSPATH-COOP-' : undefined);
        l.host(code => {
            if (link !== l) return;
            $('host-code').textContent = code;
            $('host-link').value = inviteUrl(code);
            $('btn-copy').disabled = false;
            setStatus('host-status', 'Waiting for a friend... send them the invite link or room code.');
        }, e => {
            if (link === l) setStatus('host-status', DuelLink.errorText(e), true);
        });
        l.on('hello', d => {
            if (link !== l) return;
            if (d.v !== NET_VERSION || !!d.coop !== isCoop) {
                l.send({ t: 'reject', why: 'Version mismatch - both players need the same version of the game.' });
                setStatus('host-status', 'Your opponent is running a different version of the game.', true);
                return;
            }
            if (isCoop) {
                const stored = SaveGame.read();
                const params = new URLSearchParams(location.search);
                const seed = stored ? stored.seed : params.has('seed') && Number.isFinite(Number(params.get('seed')))
                    ? Number(params.get('seed')) : Math.floor(Math.random() * 2 ** 48);
                const game = new Game(seed, canvas, stored);
                const save = SaveGame.serialize(game);
                l.send({ t: 'start', coop: true, save });
                link = null;
                startCoop(l, true, save, game);
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
    $('btn-host').onclick = () => host(false);
    $('btn-host-coop').onclick = () => host(true);

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
        const l = link = new DuelLink(coopMode ? 'RONINSPATH-COOP-' : undefined);
        joinTimer = setTimeout(() => {
            if (link === l && !(l.conn && l.conn.open)) {
                dropLink();
                setStatus('join-status', 'Could not reach that room. Check the code and try again.', true);
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
            l.send({ t: 'hello', v: NET_VERSION, look: myLook, coop: coopMode });
        };
        l.on('full', () => {
            if (link !== l) return;
            dropLink();
            setStatus('join-status', 'That room already has two swordsmen.', true);
        });
        l.on('reject', d => {
            if (link !== l) return;
            dropLink();
            setStatus('join-status', typeof d.why === 'string' ? d.why.slice(0, 120) : 'The host rejected the connection.', true);
        });
        l.on('start', d => {
            if (link !== l) return;
            if (coopMode) {
                if (!d.coop || !SaveGame.valid(d.save)) {
                    dropLink();
                    setStatus('join-status', 'Invalid journey data from host.', true);
                    return;
                }
                link = null;
                startCoop(l, false, d.save);
                return;
            }
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

    const openJoin = isCoop => {
        coopMode = isCoop;
        show('menu-join');
        $('menu-join').querySelector('h2').textContent = isCoop ? 'Join a Co-op Journey' : 'Join a Duel';
        setStatus('join-status', '');
        $('join-code').focus();
    };
    $('btn-join').onclick = () => openJoin(false);
    $('btn-join-coop').onclick = () => openJoin(true);
    $('btn-join-go').onclick = join;
    $('join-code').addEventListener('keydown', e => {
        if (e.key === 'Enter') join();
    });

    // invite links open straight into the join screen
    const params = new URLSearchParams(location.search);
    const invite = params.get('coop') || params.get('join');
    if (invite) {
        openJoin(params.has('coop'));
        $('join-code').value = DuelLink.cleanCode(invite);
        join();
    } else show('menu-main');
})();

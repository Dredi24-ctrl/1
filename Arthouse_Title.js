/*:
 * @plugindesc Arthouse Title + расширенные настройки (экран настроек, музыка/звуки, разрешение, полный экран)
 * @author Arthouse
 * @target MZ
 * @url
 *
 * @help
 * ============================================================================
 * Arthouse Title + Extended Options (RPG Maker MZ)
 * ============================================================================
 * Заменяет титульный экран в стиле "артхаус" и добавляет свой экран настроек:
 *   - Музыка (громкость BGM)
 *   - Звуки (громкость SE)
 *   - Разрешение окна (список, только для NWjs / десктопной сборки)
 *   - Полный экран (Вкл/Выкл)
 *
 * Установка:
 *   1. Скопировать файл в js/plugins/Arthouse_Title.js
 *   2. Включить в менеджере плагинов (обязательно НИЖНЕЕ core scripts,
 *      порядок относительно других плагинов не важен)
 *   3. Подготовить файлы проекта:
 *        img/characters/angel.png   — спрайт-лист ангела (4 кадра по 300x300)
 *        fonts/Roscha.ttf           — шрифт (см. параметр fontPath)
 *
 * Управление на титуле: мышь (наведение/клик) или стрелки Up/Down + Enter.
 * Настройки сохраняются через ConfigManager (sys/config.rpgsaveobject).
 *
 * @param angelPath
 * @text Путь к спрайту ангела
 * @desc Относительный путь к спрайт-листу (4 кадра x 300px)
 * @type string
 * @default img/characters/angel.png
 *
 * @param fontPath
 * @text Путь к файлу шрифта
 * @desc Относительный путь к .ttf/.otf файлу
 * @type string
 * @default fonts/Roscha.ttf
 *
 * @param fontFamily
 * @text Имя шрифта (CSS)
 * @desc Имя, под которым шрифт регистрируется в document.fonts
 * @type string
 * @default RoschaFont
 *
 * @param bgColor
 * @text Цвет фона
 * @desc HEX без #, например ffe000
 * @type string
 * @default ffe000
 *
 * @param inkColor
 * @text Цвет текста
 * @desc HEX без #, например 1a0d00
 * @type string
 * @default 1a0d00
 */

(function () {
    'use strict';

    // ===================== ПАРАМЕТРЫ ПЛАГИНА =====================
    const pluginName = 'Arthouse_Title';
    const parameters = PluginManager.parameters(pluginName);

    function paramStr(name, def) {
        const v = parameters[name];
        return (v === undefined || v === null || v === '') ? def : String(v);
    }
    function paramHex(name, def) {
        const v = parseInt(String(parameters[name] || '').replace('#', ''), 16);
        return isNaN(v) ? def : v;
    }

    // ===================== КОНФИГ =====================
    const CONFIG = {
        // Ангел
        ANGEL_PATH:              paramStr('angelPath', 'img/characters/angel.png'),
        ANGEL_FRAMES:            4,
        ANGEL_FRAME_W:           300,
        ANGEL_FRAME_H:           300,
        ANGEL_SCALE:             0.9,
        ANGEL_FPS_MIN:           6,
        ANGEL_FPS_MAX:           15,

        // Появление
        ANGEL_APPEAR_START:      0.15,
        ANGEL_APPEAR_DURATION:   0.8,
        ANGEL_APPEAR_SCALE_FROM: 0.85,
        ANGEL_APPEAR_DRIFT:      -25,

        // Нейтральное положение (отступы от края)
        ANGEL_START_X_OFFSET:    60,   // правее = меньше
        ANGEL_START_Y_OFFSET:    140,  // выше   = больше

        // Полёт
        FLY_LERP_X:              0.08,
        FLY_LERP_Y:              0.06,
        ARRIVE_DISTANCE:         25,
        HOVER_PAUSE_MS:          2200,

        // Шрифт
        FONT_FAMILY:             paramStr('fontFamily', 'RoschaFont'),
        FONT_PATH:               paramStr('fontPath', 'fonts/Roscha.ttf'),

        // Цвета
        COL_BG:                  paramHex('bgColor', 0xffe000),
        COL_INK:                 paramHex('inkColor', 0x1a0d00)
    };

    const FONT_STACK = `"${CONFIG.FONT_FAMILY}", Arial, sans-serif`;

    // ===================== РАЗРЕШЕНИЯ =====================
    const OPTIONS_RESOLUTIONS = [
        { w: 816,  h: 624,  label: "816x624"   },
        { w: 1024, h: 768,  label: "1024x768"  },
        { w: 1280, h: 720,  label: "1280x720"  },
        { w: 1366, h: 768,  label: "1366x768"  },
        { w: 1600, h: 900,  label: "1600x900"  },
        { w: 1920, h: 1080, label: "1920x1080" }
    ];

    // ===================== ПРИМЕНЕНИЕ НАСТРОЕК ЭКРАНА =====================
    // MZ: логический размер экрана меняется через Graphics.setBox (публичный API),
    // размер окна NWjs — через nw.gui. Полный экран — штатными методами Graphics.
    function applyResolution(idx) {
        const r = OPTIONS_RESOLUTIONS[idx];
        if (!r) return;
        try {
            if (Utils.isNwjs() && typeof require === 'function') {
                // Десктоп (NWjs): меняем размер самого окна
                const win = require('nw.gui').Window.get();
                if (!win.isFullscreen) {
                    win.width = r.w;
                    win.height = r.h;
                }
            } else {
                try { window.resizeTo(r.w, r.h); } catch (e) {}
            }
            // Подгоняем игровой канвас под новое соотношение сторон окна.
            // setBox(w, h, upperWidth, upperHeight): при ratioScale=true
            // канвас растягивается на всё окно с сохранением пропорций.
            if (Graphics.setBox) {
                Graphics.setBox(r.w, r.h, 0, 0);
            }
        } catch (e) {
            console.warn('[Arthouse] resize:', e);
        }
    }

    function applyFullscreen(on) {
        const isNow = !!Graphics._isFullScreen;
        if (on && !isNow) {
            try { Graphics.setFullScreen(); } catch (e) {}
        } else if (!on && isNow) {
            try { Graphics.setNormalScreen(); } catch (e) {}
        }
    }

    // ===================== СОХРАНЕНИЕ В КОНФИГ =====================
    const _ConfigManager_makeData = ConfigManager.makeData;
    ConfigManager.makeData = function () {
        const d = _ConfigManager_makeData.call(this);
        d.arthouseResolution = this.arthouseResolution;
        d.arthouseFullscreen = this.arthouseFullscreen;
        return d;
    };

    const _ConfigManager_applyData = ConfigManager.applyData;
    ConfigManager.applyData = function (config) {
        _ConfigManager_applyData.call(this, config);
        this.arthouseResolution =
            config.arthouseResolution !== undefined ? Number(config.arthouseResolution) : 0;
        this.arthouseFullscreen = !!config.arthouseFullscreen;
    };

    // ===================== SCENE: РАСШИРЕННЫЕ НАСТРОЙКИ =====================
    function Scene_ArthouseOptions() {
        this.initialize.apply(this, arguments);
    }
    Scene_ArthouseOptions.prototype = Object.create(Scene_Base.prototype);
    Scene_ArthouseOptions.prototype.constructor = Scene_ArthouseOptions;

    Scene_ArthouseOptions.prototype.create = function () {
        Scene_Base.prototype.create.call(this);
        this._buildUI();
    };

    Scene_ArthouseOptions.prototype.start = function () {
        Scene_Base.prototype.start.call(this);
        this._refreshValues();
        this._refreshSelection();
    };

    Scene_ArthouseOptions.prototype.update = function () {
        Scene_Base.prototype.update.call(this);
        if (!this.isBusy()) this._updateInput();
    };

    Scene_ArthouseOptions.prototype._buildUI = function () {
        const W = Graphics.width, H = Graphics.height;

        const container = new PIXI.Container();
        this.addChild(container);
        this._container = container;

        // Фон
        const bg = new PIXI.Graphics();
        bg.beginFill(CONFIG.COL_BG);
        bg.drawRect(0, 0, W, H);
        bg.endFill();
        container.addChild(bg);

        // Заголовок
        const title = new PIXI.Text('опционально!', {
            fontFamily: FONT_STACK, fontSize: 100, fontWeight: 'bold',
            fill: CONFIG.COL_INK
        });
        title.x = 40; title.y = 30;
        title.rotation = -0.03;
        container.addChild(title);

        // Строки настроек
        this._rows = [
            { label: 'музыка',       type: 'volume' },
            { label: 'звуки',        type: 'volume' },
            { label: 'разрешение',   type: 'resolution' },
            { label: 'полный экран', type: 'fullscreen' }
        ];
        this._rowLabels = [];
        this._rowValues = [];

        const startY = 220, stepY = 90;
        this._startY = startY;
        this._stepY = stepY;

        this._rows.forEach((row, i) => {
            const y = startY + i * stepY;

            const lbl = new PIXI.Text(row.label, {
                fontFamily: FONT_STACK, fontSize: 48, fontWeight: 'bold',
                fill: CONFIG.COL_INK
            });
            lbl.x = 80; lbl.y = y;
            container.addChild(lbl);
            this._rowLabels.push(lbl);

            const val = new PIXI.Text('', {
                fontFamily: FONT_STACK, fontSize: 48, fontWeight: 'bold',
                fill: CONFIG.COL_INK
            });
            val.anchor.set(0.5, 0);
            val.x = W - 240; val.y = y;
            container.addChild(val);
            this._rowValues.push(val);

            const arrL = new PIXI.Text('<', {
                fontFamily: FONT_STACK, fontSize: 56, fontWeight: 'bold',
                fill: CONFIG.COL_INK
            });
            arrL.anchor.set(0.5, 0);
            arrL.x = W - 400; arrL.y = y - 4;
            container.addChild(arrL);

            const arrR = new PIXI.Text('>', {
                fontFamily: FONT_STACK, fontSize: 56, fontWeight: 'bold',
                fill: CONFIG.COL_INK
            });
            arrR.anchor.set(0.5, 0);
            arrR.x = W - 60; arrR.y = y - 4;
            container.addChild(arrR);
        });

        // Кнопка назад
        const back = new PIXI.Text('← назад', {
            fontFamily: FONT_STACK, fontSize: 42, fontWeight: 'bold',
            fill: CONFIG.COL_INK
        });
        back.x = 80; back.y = H - 90;
        container.addChild(back);

        // Маркер выбранной строки
        this._marker = new PIXI.Graphics();
        container.addChild(this._marker);

        this._selectedRow = 0;
    };

    Scene_ArthouseOptions.prototype._refreshValues = function () {
        this._rowValues[0].text = String(ConfigManager.bgmVolume);
        this._rowValues[1].text = String(ConfigManager.seVolume);
        const r = OPTIONS_RESOLUTIONS[ConfigManager.arthouseResolution];
        this._rowValues[2].text = r ? r.label : '—';
        this._rowValues[3].text = ConfigManager.arthouseFullscreen ? 'Вкл' : 'Выкл';
    };

    Scene_ArthouseOptions.prototype._refreshSelection = function () {
        const y = this._startY + this._selectedRow * this._stepY;

        this._marker.clear();
        this._marker.beginFill(0x000000);
        this._marker.drawRect(40, y + 14, 8, 44);
        this._marker.endFill();

        this._rowLabels.forEach((lbl, i) => {
            const on = i === this._selectedRow;
            lbl.alpha = on ? 1.0 : 0.5;
            this._rowValues[i].alpha = on ? 1.0 : 0.5;
        });
    };

    Scene_ArthouseOptions.prototype._selectRow = function (idx) {
        const n = this._rows.length;
        this._selectedRow = (idx % n + n) % n;
        this._refreshSelection();
        SoundManager.playCursor();
    };

    Scene_ArthouseOptions.prototype._changeValue = function (dir) {
        const r = this._selectedRow;
        if (r === 0) {
            ConfigManager.bgmVolume = clamp(ConfigManager.bgmVolume + dir * 10, 0, 100);
            AudioManager.updateBgmParameters(AudioManager._currentBgm);
        } else if (r === 1) {
            ConfigManager.seVolume = clamp(ConfigManager.seVolume + dir * 10, 0, 100);
            AudioManager.updateBgsParameters(AudioManager._currentBgs);
            AudioManager.updateMeParameters(AudioManager._currentMe);
        } else if (r === 2) {
            const n = OPTIONS_RESOLUTIONS.length;
            ConfigManager.arthouseResolution =
                (Number(ConfigManager.arthouseResolution) + dir + n) % n;
            applyResolution(ConfigManager.arthouseResolution);
        } else if (r === 3) {
            ConfigManager.arthouseFullscreen = !ConfigManager.arthouseFullscreen;
            applyFullscreen(ConfigManager.arthouseFullscreen);
        }
        ConfigManager.save();
        this._refreshValues();
        SoundManager.playOk();
    };

    Scene_ArthouseOptions.prototype._updateInput = function () {
        let hadTouch = false;
        if (TouchInput.isTriggered()) {
            hadTouch = true;
            this._handleClick();
        }

        if (!hadTouch) {
            if (Input.isRepeated('up'))    this._selectRow(this._selectedRow - 1);
            if (Input.isRepeated('down'))  this._selectRow(this._selectedRow + 1);
            if (Input.isRepeated('left'))  this._changeValue(-1);
            if (Input.isRepeated('right')) this._changeValue(+1);
            if (Input.isTriggered('ok'))   this._changeValue(+1);
        }

        if (Input.isTriggered('escape') || Input.isTriggered('cancel')) {
            SoundManager.playCancel();
            this.popScene();
        }
    };

    Scene_ArthouseOptions.prototype._handleClick = function () {
        const W = Graphics.width, H = Graphics.height;
        const mx = TouchInput.x, my = TouchInput.y;

        // Назад
        if (my >= H - 110 && my <= H - 40 && mx >= 60 && mx <= 400) {
            SoundManager.playCancel();
            this.popScene();
            return;
        }

        // Строки
        for (let i = 0; i < this._rows.length; i++) {
            const y = this._startY + i * this._stepY;
            if (my >= y - 10 && my <= y + 70) {
                if (mx > W - 430 && mx < W - 370) {
                    this._selectRow(i);
                    this._changeValue(-1);
                } else if (mx > W - 100 && mx < W - 20) {
                    this._selectRow(i);
                    this._changeValue(+1);
                } else {
                    this._selectRow(i);
                }
                return;
            }
        }
    };

    Scene_ArthouseOptions.prototype.terminate = function () {
        if (this._container) {
            try { this._container.destroy({ children: true }); } catch (e) {}
            this._container = null;
        }
        Scene_Base.prototype.terminate.call(this);
    };

    // Экспорт в глобал (для вызова из событий/других плагинов)
    window.Scene_ArthouseOptions = Scene_ArthouseOptions;

    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    // ===================== ТИТУЛЬНЫЙ ЭКРАН =====================
    function buildArthouseTitle(scene) {
        if (window._arthouseCleanup) {
            try { window._arthouseCleanup(); } catch (e) {}
        }

        const W = Graphics.width, H = Graphics.height;
        const ANGEL_START_X = W - CONFIG.ANGEL_START_X_OFFSET;
        const ANGEL_START_Y = H - CONFIG.ANGEL_START_Y_OFFSET;

        // Шрифт (MZ: document.fonts + FontFace — работает в NWjs и браузере)
        try {
            const face = new FontFace(
                CONFIG.FONT_FAMILY,
                `url(${encodeURI(CONFIG.FONT_PATH)})`,
                { weight: 'bold' }
            );
            face.load()
                .then(f => { try { document.fonts.add(f); } catch (e) {} })
                .catch(err => console.warn('[Arthouse] шрифт:', err));
        } catch (e) {}

        const COL_BG = CONFIG.COL_BG, COL_INK = CONFIG.COL_INK;

        const container = new PIXI.Container();
        scene.addChild(container);
        const t0 = performance.now();

        // Фон
        const bg = new PIXI.Graphics();
        bg.beginFill(COL_BG); bg.drawRect(0, 0, W, H); bg.endFill();
        container.addChild(bg);

        // Виньетка
        try {
            const cv = document.createElement('canvas');
            cv.width = W; cv.height = H;
            const c = cv.getContext('2d');
            const g = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.0);
            g.addColorStop(0, 'rgba(0,0,0,0)');
            g.addColorStop(1, 'rgba(60,20,0,0.22)');
            c.fillStyle = g; c.fillRect(0, 0, W, H);
            container.addChild(new PIXI.Sprite(PIXI.Texture.from(cv)));
        } catch (e) {}

        // Шум
        const noise = new PIXI.Graphics();
        for (let i = 0; i < 260; i++) {
            noise.beginFill(0x000000, 0.02 + Math.random() * 0.04);
            noise.drawCircle(Math.random() * W, Math.random() * H, 0.5 + Math.random() * 1.0);
            noise.endFill();
        }
        container.addChild(noise);

        // Эпиграф
        const epigraph = new PIXI.Text('каждый вечер\nя обещаю\nчто это\nпоследний', {
            fontFamily: FONT_STACK, fontSize: 90, fontWeight: 'bold',
            fill: COL_INK, align: 'left', lineHeight: 90 * 1.05
        });
        epigraph.anchor.set(0, 0);
        epigraph.x = 40; epigraph.y = 100;
        epigraph.rotation = -0.03; epigraph.alpha = 0.15;
        container.addChild(epigraph);

        // Кнопки
        const buttons = [];
        const buttonLayer = new PIXI.Container();
        container.addChild(buttonLayer);

        function addButton(opts) {
            const text = new PIXI.Text(opts.text, {
                fontFamily: FONT_STACK, fontSize: opts.fontSize, fontWeight: 'bold',
                fill: COL_INK, align: 'left'
            });
            text.anchor.set(opts.anchorX || 0, opts.anchorY || 0);
            text.x = opts.x; text.y = opts.y;
            text.rotation = opts.rotation || 0;
            text.alpha = 0;
            buttonLayer.addChild(text);

            const marker = new PIXI.Graphics();
            marker.visible = false;
            buttonLayer.addChild(marker);

            const btn = {
                sprite: text, marker,
                action: opts.action, callback: opts.callback,
                isHovered: false, isSelected: false,
                _appearAt: opts.appearAt, _appeared: false,
                _slideY: opts.slideY || 40,
                _pos: opts,
                _pulse: opts.pulse || false
            };
            buttons.push(btn);
            return btn;
        }

        const onNewGame = () => {
            DataManager.setupNewGame();
            SceneManager.goto(Scene_Map);
        };
        const onLoadGame = () => {
            SceneManager.push(Scene_Load);
        };
        const onOptions = () => {
            SceneManager.push(Scene_ArthouseOptions);
        };

        addButton({
            text: 'налить', fontSize: 340,
            action: 'NEW_GAME', anchorX: 0, anchorY: 1,
            x: 30, y: H - 30, rotation: -0.06,
            appearAt: 0.0, slideY: 100, pulse: true,
            callback: onNewGame
        });

        addButton({
            text: 'догнаться', fontSize: 80,
            action: 'LOAD_SAVES', anchorX: 1, anchorY: 0,
            x: W - 50, y: 110, rotation: 0.04,
            appearAt: 0.35, slideY: 40,
            callback: onLoadGame
        });

        addButton({
            text: 'опционально!', fontSize: 32,
            action: 'OPTIONS', anchorX: 1, anchorY: 0,
            x: W - 50, y: 220,
            appearAt: 0.7, slideY: 20,
            callback: onOptions
        });

        // Angel (созразу, как в оригинале)
        const trailLayer = new PIXI.Container();
        container.addChild(trailLayer);

        const angel = new PIXI.Container();
        angel.alpha = 0;
        container.addChild(angel);

        const angelSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
        angelSprite.anchor.set(0.5);
        angelSprite.scale.set(CONFIG.ANGEL_SCALE);
        angel.addChild(angelSprite);

        let angelTextures = [];
        let angelFrameIdx = 0;
        let angelFrameTimer = 0;
        let angelLastTick = performance.now();
        let angelAppearAt = null;

        angel._facing = 1;
        angel._facingTarget = 1;

        const angelImg = new Image();
        angelImg.onload = () => {
            try {
                const baseTex = PIXI.BaseTexture.from(angelImg);
                for (let i = 0; i < CONFIG.ANGEL_FRAMES; i++) {
                    angelTextures.push(new PIXI.Texture(
                        baseTex,
                        new PIXI.Rectangle(
                            i * CONFIG.ANGEL_FRAME_W, 0,
                            CONFIG.ANGEL_FRAME_W, CONFIG.ANGEL_FRAME_H
                        )
                    ));
                }
                angelSprite.texture = angelTextures[0];
                angelAppearAt = performance.now() + CONFIG.ANGEL_APPEAR_START * 1000;
                console.log('[Arthouse] ✓ Ангел загружен:', CONFIG.ANGEL_PATH);
            } catch (e) {
                console.error('[Arthouse] Ошибка нарезки:', e);
            }
        };
        angelImg.onerror = () => console.error('[Arthouse] ✗ Не загрузился:', CONFIG.ANGEL_PATH);
        angelImg.src = CONFIG.ANGEL_PATH;

        let angelTargets = [{ x: ANGEL_START_X, y: ANGEL_START_Y }];
        let angelTargetIdx = 0;
        let angelArrivedAt = 0;

        angel._currentX = ANGEL_START_X;
        angel._currentY = ANGEL_START_Y;
        angel._targetX = ANGEL_START_X;
        angel._targetY = ANGEL_START_Y;

        function getAngelTargets(action) {
            switch (action) {
                case 'NEW_GAME': return [
                    { x: W * 0.68, y: H * 0.62 },
                    { x: W * 0.85, y: H * 0.58 },
                    { x: W * 0.92, y: H * 0.65 },
                    { x: W * 0.80, y: H * 0.70 },
                    { x: W * 0.70, y: H * 0.68 }
                ];
                case 'LOAD_SAVES': return [
                    { x: W - 660, y: H * 0.24 },
                    { x: W - 700, y: H * 0.20 },
                    { x: W - 620, y: H * 0.28 },
                    { x: W - 680, y: H * 0.32 }
                ];
                case 'OPTIONS': return [
                    { x: W - 480, y: 235 },
                    { x: W - 520, y: 210 },
                    { x: W - 440, y: 260 },
                    { x: W - 500, y: 280 }
                ];
                default: return [{ x: W / 2, y: H / 2 }];
            }
        }

        function computeBounds(b) {
            const t = b.sprite;
            const tw = t.width, th = t.height;
            const ax = b._pos.anchorX || 0;
            const ay = b._pos.anchorY || 0;
            return { x: t.x - tw * ax, y: t.y - th * ay, w: tw, h: th };
        }

        function drawMarker(b) {
            if (b._pos.action === 'NEW_GAME') { b.marker.visible = false; return; }
            if (!b.isSelected && !b.isHovered) { b.marker.visible = false; return; }
            const bd = computeBounds(b);
            b.marker.clear(); b.marker.visible = true;
            if (b.isSelected) {
                const thickness = Math.max(4, b.sprite.style.fontSize * 0.025);
                const gap = Math.max(10, b.sprite.style.fontSize * 0.06);
                b.marker.beginFill(0x000000, 1);
                b.marker.drawRect(bd.x - gap - thickness, bd.y + bd.h * 0.1, thickness, bd.h * 0.8);
                b.marker.endFill();
            } else if (b.isHovered) {
                const th = Math.max(2, b.sprite.style.fontSize * 0.02);
                b.marker.beginFill(COL_INK, 0.6);
                b.marker.drawRect(bd.x, bd.y + bd.h - th, bd.w, th);
                b.marker.endFill();
            }
        }

        let currentSelected = -1;

        function selectButton(idx) {
            if (idx === currentSelected) return;
            currentSelected = idx;
            buttons.forEach((b, i) => {
                b.isSelected = (i === idx);
                b.sprite.style.fill = b.isSelected ? 0x000000 : COL_INK;
                drawMarker(b);
            });
            angelTargets = getAngelTargets(buttons[idx].action);
            angelTargetIdx = 0;
            angel._targetX = angelTargets[0].x;
            angel._targetY = angelTargets[0].y;
            angelArrivedAt = 0;
            SoundManager.playCursor();
        }

        let rafId = null;

        function update(now) {
            const el = (now - t0) / 1000;
            const dt = now - angelLastTick;
            angelLastTick = now;

            // Появление кнопок
            buttons.forEach(b => {
                if (b._appeared) return;
                const t = clamp((el - b._appearAt) / 0.55, 0, 1);
                const e = 1 - Math.pow(1 - t, 3);
                b.sprite.alpha = e;
                b.sprite.y = b._pos.y + (1 - e) * b._slideY;
                if (t >= 1) { b._appeared = true; b.sprite.y = b._pos.y; }
            });

            // Пульс главной кнопки
            buttons.forEach(b => {
                if (!b._pulse || !b._appeared) return;
                const k = 0.01 * (1 + Math.sin(now / 1200));
                b.sprite.scale.set(1.0 + k);
            });

            // Мерцание шума
            noise.alpha = 0.85 + 0.15 * Math.sin(now / 400);

            // Появление ангела
            let appearProgress = 0;
            if (angelAppearAt !== null) {
                appearProgress = clamp(
                    (now - angelAppearAt) / (CONFIG.ANGEL_APPEAR_DURATION * 1000), 0, 1
                );
            }
            angel.alpha = appearProgress;
            const appearScale = CONFIG.ANGEL_APPEAR_SCALE_FROM +
                (1 - CONFIG.ANGEL_APPEAR_SCALE_FROM) * appearProgress;
            const appearDrift = CONFIG.ANGEL_APPEAR_DRIFT * (1 - appearProgress);

            // Полёт
            const dx = angel._targetX - angel._currentX;
            const dy = angel._targetY - angel._currentY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            angel._currentX += dx * CONFIG.FLY_LERP_X;
            angel._currentY += dy * CONFIG.FLY_LERP_Y;

            if (dist < CONFIG.ARRIVE_DISTANCE && appearProgress >= 1) {
                if (angelArrivedAt === 0) angelArrivedAt = now;
                else if (now - angelArrivedAt > CONFIG.HOVER_PAUSE_MS && angelTargets.length > 1) {
                    angelTargetIdx = (angelTargetIdx + 1) % angelTargets.length;
                    angel._targetX = angelTargets[angelTargetIdx].x;
                    angel._targetY = angelTargets[angelTargetIdx].y;
                    angelArrivedAt = 0;
                }
            } else {
                angelArrivedAt = 0;
            }

            // Покачивание перпендикулярно направлению движения
            const dirX = dist > 1 ? dx / dist : 1;
            const dirY = dist > 1 ? dy / dist : 0;
            const perpX = -dirY, perpY = dirX;
            const swayAmp = Math.min(40, 6 + dist * 0.18);
            const sway = Math.sin(now / 220) * swayAmp;
            const visualX = angel._currentX + perpX * sway;
            const visualY = angel._currentY + perpY * sway;

            const bob = Math.sin(now / 450) * 5;
            angel.x = visualX;
            angel.y = visualY + bob + appearDrift;

            // Ориентация (look at selected button)
            const targetBtn = buttons[currentSelected];
            if (targetBtn) {
                const bd = computeBounds(targetBtn);
                const btnCenterX = bd.x + bd.w / 2;
                const dxToText = btnCenterX - angel.x;
                if (Math.abs(dxToText) > 25) {
                    angel._facingTarget = dxToText > 0 ? -1 : 1;
                }
            }
            angel._facing += (angel._facingTarget - angel._facing) * 0.12;

            // Наклон при полёте
            const speedFactor = Math.min(1, dist / 100);
            const moveTilt = (angel._facingTarget === 1 ? 1 : -1) * 0.12;
            const idleTilt = Math.sin(now / 1500) * 0.04;
            const targetTilt = moveTilt * speedFactor + idleTilt * (1 - speedFactor);
            angel.rotation += (targetTilt - angel.rotation) * 0.08;

            // Масштаб + flip по X
            const pulseScale = 1 + speedFactor * 0.08;
            angelSprite.scale.set(
                CONFIG.ANGEL_SCALE * pulseScale * angel._facing * appearScale,
                CONFIG.ANGEL_SCALE * pulseScale * appearScale
            );

            // Анимация кадров (скорость зависит от дистанции)
            const fps = CONFIG.ANGEL_FPS_MIN +
                Math.min(CONFIG.ANGEL_FPS_MAX - CONFIG.ANGEL_FPS_MIN, dist * 1.5);
            const msPerFrame = 1000 / fps;
            if (angelTextures.length > 0) {
                angelFrameTimer += dt;
                if (angelFrameTimer >= msPerFrame) {
                    angelFrameTimer = 0;
                    angelFrameIdx = (angelFrameIdx + 1) % CONFIG.ANGEL_FRAMES;
                    angelSprite.texture = angelTextures[angelFrameIdx];
                }
            }

            // Trail dots
            if (dist > 3 && angel.alpha > 0.5 && Math.random() < 0.5) {
                const dot = new PIXI.Graphics();
                dot.beginFill(COL_INK, 0.35);
                dot.drawCircle(0, 0, 2 + Math.random() * 1.5);
                dot.endFill();
                dot.x = visualX + (Math.random() - 0.5) * 25;
                dot.y = visualY + bob + (Math.random() - 0.5) * 25;
                dot._life = 1;
                trailLayer.addChild(dot);
            }
            for (let i = trailLayer.children.length - 1; i >= 0; i--) {
                const d = trailLayer.children[i];
                d._life -= 0.025;
                d.alpha = Math.max(0, d._life * 0.4);
                d.scale.set(0.5 + d._life * 0.5);
                if (d._life <= 0) {
                    trailLayer.removeChild(d);
                    try { d.destroy(); } catch (e) {}
                }
            }

            // Hover detection
            const mx = TouchInput.x, my = TouchInput.y;
            let hoveredIdx = -1;
            buttons.forEach((b, i) => {
                if (!b._appeared) return;
                const bd = computeBounds(b);
                const pad = 12;
                if (mx >= bd.x - pad && mx <= bd.x + bd.w + pad &&
                    my >= bd.y - pad && my <= bd.y + bd.h + pad) {
                    hoveredIdx = i;
                }
            });
            buttons.forEach((b, i) => {
                const hov = (i === hoveredIdx);
                if (b.isHovered !== hov) { b.isHovered = hov; drawMarker(b); }
            });

            if (hoveredIdx >= 0 && hoveredIdx !== currentSelected) {
                selectButton(hoveredIdx);
            }

            if (TouchInput.isTriggered() && hoveredIdx >= 0) {
                selectButton(hoveredIdx);
                try { buttons[hoveredIdx].callback(); } catch (e) { console.error(e); }
            }

            // Keyboard navigation
            if (Input.isRepeated('down')) {
                const next = currentSelected < 0 ? 0 : (currentSelected + 1) % buttons.length;
                selectButton(next);
            }
            if (Input.isRepeated('up')) {
                const next = currentSelected < 0 ? buttons.length - 1
                    : (currentSelected - 1 + buttons.length) % buttons.length;
                selectButton(next);
            }
            if (Input.isTriggered('ok') && currentSelected >= 0) {
                try { buttons[currentSelected].callback(); } catch (e) { console.error(e); }
            }

            rafId = requestAnimationFrame(update);
        }

        function cleanup() {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = null;
            if (container.parent) container.parent.removeChild(container);
            try { container.destroy({ children: true }); } catch (e) {}
            window._arthouseCleanup = null;
        }
        window._arthouseCleanup = cleanup;

        rafId = requestAnimationFrame(update);
        console.log('[Arthouse Title v2.0] ✓ Титул + расширенные настройки');
    }

    // ===================== ХУК Scene_Title =====================
    const _Scene_Title_create = Scene_Title.prototype.create;
    Scene_Title.prototype.create = function () {
        _Scene_Title_create.call(this);

        try {
            buildArthouseTitle(this);
        } catch (e) {
            console.error('[Arthouse Title] build failed:', e);
        }

        // Применяем сохранённые настройки экрана при запуске
        try {
            if (ConfigManager.arthouseResolution > 0) {
                applyResolution(ConfigManager.arthouseResolution);
            }
            if (ConfigManager.arthouseFullscreen === true) {
                setTimeout(() => applyFullscreen(true), 200);
            }
        } catch (e) {
            console.warn('[Arthouse] boot apply:', e);
        }
    };

    const _Scene_Title_terminate = Scene_Title.prototype.terminate;
    Scene_Title.prototype.terminate = function () {
        if (window._arthouseCleanup) {
            try { window._arthouseCleanup(); } catch (e) {}
        }
        _Scene_Title_terminate.call(this);
    };

})();

/*:
 * @plugindesc Arthouse Title + расширенные настройки (музыка/звуки, разрешение, полный экран, настройка клавиш и геймпада)
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
 *   - Настройка клавиш клавиатуры (ремап кнопок gamepad mapping'а)
 *   - Настройка кнопок геймпада (ремап buttons[0..15] на игровые действия)
 *
 * Экран настройки клавиш/геймпада открывается кнопкой "опционально!" →
 * строками "клавиши..." и "геймпад...". Там же есть "сброс" к значениям
 * по умолчанию. Назначения сохраняются через ConfigManager.
 *
 * Как работает ремап:
 *   Плагин хранит два маппинга в ConfigManager:
 *     arthouseKeyMap:    действие -> массив keyCode'ев (KeyboardEvent.code)
 *     arthousePadMap:    действие -> массив индексов кнопок Gamepad
 *   Действия: ok, escape, menu, cancel, shift, control, pageup, pagedown,
 *             left, right, up, down.
 *   При опросе ввода Input.isPressed/isTriggered/isRepeated сначала смотрит
 *   в пользовательские маппинги, затем — в стандартные таблицы MZ.
 *   Геймпад полностью поддерживается без ручного ремапа "из коробки"
 *   (стандартный XInput-маппинг MZ), а этот экран позволяет назначить
 *   любые кнопки вместо стандартных.
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
 *
 * @param keyActions
 * @text Действия для ремапа (клавиатура/геймпад)
 * @desc Список действий, которые можно переназначить на экране настроек.
 *       По умолчанию: ok,escape,menu,cancel,left,right,up,down
 * @type string
 * @default ok,escape,menu,cancel,left,right,up,down
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
    // Дефолтные маппинги — копия стандартных таблиц MZ (Input.keyMapper и
    // Input.gamepadMapping), чтобы при первом запуске поведение совпадало
    // с ванильным. Объявлены до хука ConfigManager.applyData.
    const DEFAULT_KEY_MAP = {
        ok:       ['Enter', 'Space', 'NumpadEnter', 'KeyZ'],
        escape:   ['Escape'],
        menu:     ['Escape', 'KeyM'],
        cancel:   ['Escape', 'KeyX'],
        shift:    ['ShiftLeft', 'ShiftRight', 'KeyA'],
        control:  ['ControlLeft', 'ControlRight', 'KeyS'],
        pageup:   ['PageUp', 'KeyQ'],
        pagedown: ['PageDown', 'KeyW'],
        left:     ['ArrowLeft'],
        right:    ['ArrowRight'],
        up:       ['ArrowUp'],
        down:     ['ArrowDown']
    };

    const DEFAULT_PAD_MAP = {
        ok:       [1],          // B/Cross
        escape:   [9],          // Start/Options
        menu:     [9],
        cancel:   [0],          // A/Circle
        shift:    [6],          // L1/LB
        control:  [7],          // R1/RB
        pageup:   [4],          // L2/LT
        pagedown: [5],          // R2/RT
        left:     [14],         // D-Pad Left
        right:    [15],         // D-Pad Right
        up:       [12],         // D-Pad Up
        down:     [13]          // D-Pad Down
    };

    ConfigManager.arthouseKeyMap = cloneMap(DEFAULT_KEY_MAP);
    ConfigManager.arthousePadMap = cloneMap(DEFAULT_PAD_MAP);

    // Утилиты маппинга (используются и хуком applyData ниже)
    function dedupe(arr) {
        return Array.from(new Set(arr));
    }
    function cloneMap(m) {
        const out = {};
        for (const k in m) out[k] = m[k].slice();
        return out;
    }
    // Валидация загруженного из конфига маппинга: недостающие действия
    // заполняем дефолтами, мусор (строки/объекты/неверный тип) выбрасываем.
    function sanitizeMap(raw, defaults) {
        const out = {};
        for (const a of Object.keys(defaults)) {
            const def = defaults[a] || [];
            if (raw && Array.isArray(raw[a])) {
                const clean = raw[a].filter(v => typeof v === typeof def[0]);
                out[a] = (clean.length || def.length === 0) ? dedupe(clean) : dedupe(def.slice());
            } else {
                out[a] = dedupe(def.slice());
            }
        }
        return out;
    }

    const _ConfigManager_makeData = ConfigManager.makeData;
    ConfigManager.makeData = function () {
        const d = _ConfigManager_makeData.call(this);
        d.arthouseResolution = this.arthouseResolution;
        d.arthouseFullscreen = this.arthouseFullscreen;
        d.arthouseKeyMap = this.arthouseKeyMap;
        d.arthousePadMap = this.arthousePadMap;
        return d;
    };

    const _ConfigManager_applyData = ConfigManager.applyData;
    ConfigManager.applyData = function (config) {
        _ConfigManager_applyData.call(this, config);
        this.arthouseResolution =
            config.arthouseResolution !== undefined ? Number(config.arthouseResolution) : 0;
        this.arthouseFullscreen = !!config.arthouseFullscreen;
        // Маппинги клавиш/геймпада (валидируем структуру из rpgsave)
        this.arthouseKeyMap = sanitizeMap(config.arthouseKeyMap, DEFAULT_KEY_MAP);
        this.arthousePadMap = sanitizeMap(config.arthousePadMap, DEFAULT_PAD_MAP);
    };

    // ===================== РЕМАП КЛАВИШ И ГЕЙМПАДА =====================
    // Действия — те же имена, что использует Input.gamepadMapping() MZ.
    // Порядок списка = порядок строк на экранах настройки.
    const ACTIONS = ['ok', 'escape', 'menu', 'cancel', 'left', 'right', 'up', 'down'];

    // Какие действия показывать на экранах настройки (параметр keyActions)
    const EDITABLE_ACTIONS = (() => {
        const raw = paramStr('keyActions', '')
            .split(',').map(s => s.trim().toLowerCase())
            .filter(a => ACTIONS.includes(a));
        return raw.length ? raw : ACTIONS.slice();
    })();

    // Человекочитаемые имена клавиш (KeyboardEvent.code -> метка)
    const KEY_LABELS = {
        Enter: 'Enter', NumpadEnter: 'Num Enter', Space: 'Space', Tab: 'Tab',
        Escape: 'Esc', Backspace: 'Back',
        ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift',
        ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl',
        AltLeft: 'L-Alt', AltRight: 'R-Alt',
        PageUp: 'PgUp', PageDown: 'PgDn', Home: 'Home', End: 'End', Insert: 'Ins', Delete: 'Del',
        ArrowLeft: '←', ArrowUp: '↑', ArrowRight: '→', ArrowDown: '↓',
        KeyA: 'A', KeyB: 'B', KeyC: 'C', KeyD: 'D', KeyE: 'E', KeyF: 'F', KeyG: 'G', KeyH: 'H',
        KeyI: 'I', KeyJ: 'J', KeyK: 'K', KeyL: 'L', KeyM: 'M', KeyN: 'N', KeyO: 'O', KeyP: 'P',
        KeyQ: 'Q', KeyR: 'R', KeyS: 'S', KeyT: 'T', KeyU: 'U', KeyV: 'V', KeyW: 'W', KeyX: 'X',
        KeyY: 'Y', KeyZ: 'Z',
        Digit0: '0', Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4',
        Digit5: '5', Digit6: '6', Digit7: '7', Digit8: '8', Digit9: '9',
        Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
        Semicolon: ';', Quote: "'", Backquote: '`', Backslash: '\\',
        Comma: ',', Period: '.', Slash: '/',
        Numpad0: 'Num0', Numpad1: 'Num1', Numpad2: 'Num2', Numpad3: 'Num3',
        Numpad4: 'Num4', Numpad5: 'Num5', Numpad6: 'Num6', Numpad7: 'Num7',
        Numpad8: 'Num8', Numpad9: 'Num9', NumpadAdd: 'Num+', NumpadSubtract: 'Num-',
        NumpadMultiply: 'Num*', NumpadDivide: 'Num/', NumpadDecimal: 'Num.',
        F1: 'F1', F2: 'F2', F3: 'F3', F4: 'F4', F5: 'F5', F6: 'F6',
        F7: 'F7', F8: 'F8', F9: 'F9', F10: 'F10', F11: 'F11', F12: 'F12'
    };

    // Названия кнопок геймпада (стандартный порядок Gamepad API / XInput)
    const PAD_BUTTON_NAMES = [
        'A/Circle', 'B/Cross', 'X/Square', 'Y/Triangle',
        'LB/L1', 'RB/R1', 'LT/L2', 'RT/R2',
        'Back/Share', 'Start/Opts', 'Stick L3', 'Stick R3',
        'D-Up', 'D-Down', 'D-Left', 'D-Right'
    ];

    const ACTION_LABELS_RU = {
        ok: 'ОК / подтвердить', escape: 'Esc / выход', menu: 'Меню',
        cancel: 'Отмена', shift: 'Рывок (Shift)', control: 'Стоп (Ctrl)',
        pageup: 'Стр. вверх', pagedown: 'Стр. вниз',
        left: 'Влево', right: 'Вправо', up: 'Вверх', down: 'Вниз'
    };

    function keyLabel(code) {
        return KEY_LABELS[code] || code.replace(/^Key/, '').replace(/^Digit/, '');
    }
    function padLabel(idx) {
        return PAD_BUTTON_NAMES[idx] || ('Btn ' + idx);
    }

    // ---------- Хуки Input: пользовательские маппинги ----------
    // Свой "триггер"-детект для клавиатуры: onKeyPress очищает _keys,
    // поэтому standardTriggered не подходит — ведём prev-снимки сами.
    Input._arthousePrevKeys = null;
    Input._arthousePrevPads = null;

    Input._arthouseKeyTriggered = function (mapping) {
        if (!this._arthousePrevKeys) return false;
        return mapping.some(keyCode =>
            this._keys[keyCode] && !this._arthousePrevKeys[keyCode]);
    };

    Input._arthousePadPressed = function (buttonId) {
        const pads = navigator.gamepads || this.gamepads();
        if (!pads) return false;
        for (let i = 0; i < pads.length; i++) {
            const pad = pads[i];
            if (pad && pad.buttons[buttonId] && pad.buttons[buttonId].pressed) return true;
        }
        return false;
    };

    Input._arthousePadTriggered = function (buttonId) {
        if (!this._arthousePrevPads) return false;
        const pads = navigator.gamepads || this.gamepads();
        if (!pads) return false;
        for (let i = 0; i < pads.length; i++) {
            const pad = pads[i];
            const prev = this._arthousePrevPads[i];
            if (pad && prev) {
                const b = pad.buttons[buttonId];
                const p = prev[buttonId];
                if (b && b.pressed && !p) return true;
            }
        }
        return false;
    };

    // Обновление prev-снимков один раз за игровой цикл (Scene_Base.update)
    Input._arthouseUpdateSnapshots = function () {
        this._arthousePrevKeys = Object.assign({}, this._keys);
        const pads = navigator.gamepads || this.gamepads();
        if (pads) {
            this._arthousePrevPads = this._arthousePrevPads || [];
            for (let i = 0; i < pads.length; i++) {
                const pad = pads[i];
                if (!pad) continue;
                const snap = this._arthousePrevPads[i] = this._arthousePrevPads[i] || [];
                for (let j = 0; j < pad.buttons.length; j++) {
                    snap[j] = pad.buttons[j] ? pad.buttons[j].pressed : false;
                }
            }
        }
    };

    const _Input_isPressed = Input.isPressed;
    Input.isPressed = function (mapping) {
        const km = ConfigManager.arthouseKeyMap;
        if (km && km[mapping] && km[mapping].some(c => this._keys[c])) return true;
        const pm = ConfigManager.arthousePadMap;
        if (pm && pm[mapping] && pm[mapping].some(b => this._arthousePadPressed(b))) return true;
        return _Input_isPressed.call(this, mapping);
    };

    const _Input_isTriggered = Input.isTriggered;
    Input.isTriggered = function (mapping) {
        const km = ConfigManager.arthouseKeyMap;
        if (km && km[mapping] && this._arthouseKeyTriggered(km[mapping])) return true;
        const pm = ConfigManager.arthousePadMap;
        if (pm && pm[mapping] && pm[mapping].some(b => this._arthousePadTriggered(b))) return true;
        return _Input_isTriggered.call(this, mapping);
    };

    const _Input_isRepeated = Input.isRepeated;
    Input.isRepeated = function (mapping) {
        // isRepeated == triggered || pressed — достаточно делегнуть в isPressed,
        // т.к. оригинал внутри вызывает именно их.
        return _Input_isRepeated.call(this, mapping);
    };

    // Снимки обновляются в начале каждого игрового кадра
    const _Scene_Base_update = Scene_Base.prototype.update;
    Scene_Base.prototype.update = function () {
        Input._arthouseUpdateSnapshots();
        _Scene_Base_update.call(this);
    };

    // Разрешённые клавиши для захвата (без сервисных: Esc/F12 и т.п.)
    const BLOCKED_KEYS = new Set([
        'F4', 'F5', 'F12', 'Tab', 'Escape',
        'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'ContextMenu'
    ]);

    // ---------- БАЗОВЫЙ ЭКРАН НАСТРОЙКИ (клавиши / геймпад) ----------
    function Scene_ArthouseRebind() {
        throw new Error('Scene_ArthouseRebind is abstract');
    }
    Scene_ArthouseRebind.prototype = Object.create(Scene_Base.prototype);
    Scene_ArthouseRebind.prototype.constructor = Scene_ArthouseRebind;

    // Переопределяются в наследниках:
    //  _kind   : 'key' | 'pad'
    //  _map()  : ссылка на текущий маппинг ConfigManager
    //  _label(binding) : текст назначенного значения
    //  _capture(e) : event -> binding (или null)

    Scene_ArthouseRebind.prototype.create = function () {
        Scene_Base.prototype.create.call(this);
        this._actions = EDITABLE_ACTIONS.slice();
        this._selectedAction = 0;
        this._mode = 'select';        // 'select' | 'edit' | 'confirmClear'
        this._buildUI();
    };

    Scene_ArthouseRebind.prototype.start = function () {
        Scene_Base.prototype.start.call(this);
        SoundManager.playOk();
        this._refreshValues();
        this._refreshSelection();
    };

    Scene_ArthouseRebind.prototype._buildUI = function () {
        const W = Graphics.width, H = Graphics.height;

        const container = new PIXI.Container();
        this.addChild(container);
        this._container = container;

        const bg = new PIXI.Graphics();
        bg.beginFill(CONFIG.COL_BG);
        bg.drawRect(0, 0, W, H);
        bg.endFill();
        container.addChild(bg);

        const title = new PIXI.Text(this._titleText(), {
            fontFamily: FONT_STACK, fontSize: 80, fontWeight: 'bold',
            fill: CONFIG.COL_INK
        });
        title.x = 40; title.y = 25;
        title.rotation = -0.03;
        container.addChild(title);

        this._hint = new PIXI.Text('', {
            fontFamily: FONT_STACK, fontSize: 26, fontWeight: 'bold',
            fill: CONFIG.COL_INK, wordWrap: true, wordWrapWidth: W - 80
        });
        this._hint.x = 40; this._hint.y = 118;
        container.addChild(this._hint);

        this._rowLabels = [];
        this._rowValues = [];

        const startY = 175;
        const n = this._actions.length;
        const stepY = Math.min(62, Math.max(40, (H - startY - 130) / n));
        this._startY = startY;
        this._stepY = stepY;

        this._actions.forEach((action, i) => {
            const y = startY + i * stepY;

            const lbl = new PIXI.Text(ACTION_LABELS_RU[action] || action, {
                fontFamily: FONT_STACK, fontSize: Math.min(34, stepY * 0.7),
                fontWeight: 'bold', fill: CONFIG.COL_INK
            });
            lbl.x = 80; lbl.y = y;
            container.addChild(lbl);
            this._rowLabels.push(lbl);

            const val = new PIXI.Text('', {
                fontFamily: FONT_STACK, fontSize: Math.min(34, stepY * 0.7),
                fontWeight: 'bold', fill: CONFIG.COL_INK
            });
            val.anchor.set(1, 0);
            val.x = W - 70; val.y = y;
            container.addChild(val);
            this._rowValues.push(val);
        });

        const back = new PIXI.Text('← назад (Esc)', {
            fontFamily: FONT_STACK, fontSize: 34, fontWeight: 'bold',
            fill: CONFIG.COL_INK
        });
        back.x = 80; back.y = H - 75;
        container.addChild(back);

        this._marker = new PIXI.Graphics();
        container.addChild(this._marker);
    };

    Scene_ArthouseRebind.prototype._refreshValues = function () {
        const map = this._map();
        this._actions.forEach((a, i) => {
            const bindings = map[a] || [];
            this._rowValues[i].text = bindings.length
                ? bindings.map(b => this._label(b)).join(' + ')
                : '— нет —';
        });
    };

    Scene_ArthouseRebind.prototype._refreshSelection = function () {
        const y = this._startY + this._selectedAction * this._stepY;
        const h = this._stepY * 0.75;

        this._marker.clear();
        this._marker.beginFill(this._mode === 'edit' ? 0xd03000 : 0x000000);
        this._marker.drawRect(45, y + 2, 9, h);
        this._marker.endFill();

        this._rowLabels.forEach((lbl, i) => {
            const on = i === this._selectedAction;
            const editing = on && this._mode === 'edit';
            lbl.alpha = on ? 1.0 : 0.5;
            this._rowValues[i].alpha = on ? 1.0 : 0.5;
            this._rowValues[i].style.fill = editing ? 0xd03000 : CONFIG.COL_INK;
        });

        this._hint.text = this._hintText();
    };

    Scene_ArthouseRebind.prototype._hintText = function () {
        if (this._mode === 'confirmClear') {
            return 'Очистить назначение?  OK/Enter — да,  любая другая клавиша / Esc — нет';
        }
        if (this._mode === 'edit') return this._editHint();
        return this._selectHint();
    };

    Scene_ArthouseRebind.prototype._selectRow = function (idx) {
        const n = this._actions.length;
        this._selectedAction = (idx % n + n) % n;
        this._refreshSelection();
        SoundManager.playCursor();
    };

    Scene_ArthouseRebind.prototype.update = function () {
        Scene_Base.prototype.update.call(this);
        if (TouchInput.isTriggered()) this._handleClick();
    };

    Scene_ArthouseRebind.prototype._handleClick = function () {
        const W = Graphics.width, H = Graphics.height;
        const mx = TouchInput.x, my = TouchInput.y;

        if (my >= H - 95 && my <= H - 30 && mx >= 60 && mx <= 420) {
            this._exitScene();
            return;
        }
        for (let i = 0; i < this._actions.length; i++) {
            const y = this._startY + i * this._stepY;
            if (my >= y - 6 && my <= y + this._stepY - 6) {
                this._selectedAction = i;
                this._enterEdit();
                return;
            }
        }
    };

    Scene_ArthouseRebind.prototype._enterEdit = function () {
        this._mode = 'edit';
        this._refreshSelection();
        SoundManager.playCursor();
    };

    Scene_ArthouseRebind.prototype._exitScene = function () {
        SoundManager.playCancel();
        this.popScene();
    };

    Scene_ArthouseRebind.prototype.terminate = function () {
        document.removeEventListener('keydown', this._onKeyDownBound, true);
        window.removeEventListener('gamepadconnected', this._onPadConnectedBound, false);
        if (this._container) {
            try { this._container.destroy({ children: true }); } catch (e) {}
            this._container = null;
        }
        Scene_Base.prototype.terminate.call(this);
    };

    // ---------- Экран КЛАВИАТУРЫ ----------
    function Scene_ArthouseKeyConfig() {
        this.initialize.apply(this, arguments);
    }
    Scene_ArthouseKeyConfig.prototype = Object.create(Scene_ArthouseRebind.prototype);
    Scene_ArthouseKeyConfig.prototype.constructor = Scene_ArthouseKeyConfig;

    Scene_ArthouseKeyConfig.prototype._kind = 'key';

    Scene_ArthouseKeyConfig.prototype._titleText = function () {
        return 'клавиши!';
    };
    Scene_ArthouseKeyConfig.prototype._selectHint = function () {
        return '↑/↓ или клик — выбрать действие · Enter/OK — назначить · Del — очистить · Esc — назад';
    };
    Scene_ArthouseKeyConfig.prototype._editHint = function () {
        return 'Нажмите клавишу…  Enter — добавить ещё,  Del — очистить,  Esc — отмена';
    };

    Scene_ArthouseKeyConfig.prototype._map = function () {
        return ConfigManager.arthouseKeyMap;
    };
    Scene_ArthouseKeyConfig.prototype._label = function (code) {
        return keyLabel(code);
    };

    Scene_ArthouseKeyConfig.prototype.start = function () {
        Scene_ArthouseRebind.prototype.start.call(this);
        // Перехватываем keydown ДО обработчика MZ (capture-фаза),
        // чтобы F4/F5 не перезагружали игру во время захвата.
        this._onKeyDownBound = this._onDocumentKeyDown.bind(this);
        document.addEventListener('keydown', this._onKeyDownBound, true);
    };

    Scene_ArthouseKeyConfig.prototype._enterEdit = function () {
        this._capturedThisFrame = false;
        Scene_ArthouseRebind.prototype._enterEdit.call(this);
    };

    Scene_ArthouseKeyConfig.prototype._onDocumentKeyDown = function (ev) {
        if (this._mode !== 'edit') return;      // select-режим обрабатывает update()
        ev.stopPropagation();                   // не отдавать событие движку
        if (this._capturedThisFrame) return;    // защита от автоповтора
        this._capturedThisFrame = true;

        const code = ev.code;

        if (code === 'Escape') {                // отмена захвата
            this._mode = 'select';
            this._refreshSelection();
            SoundManager.playBuzzer();
            return;
        }
        if (code === 'Delete' || code === 'Backspace') {
            this._mode = 'confirmClear';
            this._refreshSelection();
            SoundManager.playBuzzer();
            return;
        }
        if (BLOCKED_KEYS.has(code)) {
            SoundManager.playBuzzer();
            return;
        }

        const map = this._map();
        const action = this._actions[this._selectedAction];
        map[action] = map[action] || [];
        if (map[action].includes(code)) {
            SoundManager.playBuzzer();          // уже назначена
            return;
        }
        map[action].push(code);
        ConfigManager.save();
        this._refreshValues();

        if (code === 'Enter') {                 // Enter = завершить ввод
            this._mode = 'select';
            this._refreshSelection();
            SoundManager.playOk();
        } else {
            // назначили вспомогательную клавишу — можно добавить ещё одну
            this._capturedThisFrame = false;
            SoundManager.playOk();
        }
    };

    Scene_ArthouseKeyConfig.prototype.update = function () {
        Scene_ArthouseRebind.prototype.update.call(this);
        if (this._mode === 'edit') return;      // ввод идёт через capture-хук

        if (Input.isRepeated('down'))  this._selectRow(this._selectedAction + 1);
        if (Input.isRepeated('up'))    this._selectRow(this._selectedAction - 1);

        if (this._mode === 'select') {
            // В select-режиме "escape/menu/cancel" = выход со экрана,
            // "ok" = начать назначение. (Захват клавиши идёт через capture-хук.)
            if (Input.isTriggered('ok')) {
                this._enterEdit();
            } else if (Input.isTriggered('escape') || Input.isTriggered('menu') ||
                       Input.isTriggered('cancel')) {
                this._exitScene();
            }
            if (Input.isTriggered('shift') || Input.isTriggered('control')) {
                this._mode = 'confirmClear';
                this._refreshSelection();
                SoundManager.playBuzzer();
            }
        } else if (this._mode === 'confirmClear') {
            if (Input.isTriggered('ok') || Input.isTriggered('escape') ||
                Input.isTriggered('menu') || Input.isTriggered('cancel')) {
                // "да" = та же кнопка подтверждения/отмены → чистим
                this._clearSelected();
                this._mode = 'select';
                this._refreshSelection();
            } else if (Input.isTriggered('shift') || Input.isTriggered('control')) {
                this._mode = 'select';          // "нет"
                this._refreshSelection();
                SoundManager.playCancel();
            }
        }

        // Сброс всех назначений — PgUp/PgDn или Shift+Del-строка не нужна:
        if (Input.isTriggered('pageup') || Input.isTriggered('pagedown')) {
            this._resetAll();
        }
    };

    Scene_ArthouseKeyConfig.prototype._clearSelected = function () {
        const map = this._map();
        map[this._actions[this._selectedAction]] = [];
        ConfigManager.save();
        this._refreshValues();
        SoundManager.playCancel();
    };

    Scene_ArthouseKeyConfig.prototype._resetAll = function () {
        ConfigManager.arthouseKeyMap = sanitizeMap(null, DEFAULT_KEY_MAP);
        ConfigManager.save();
        this._refreshValues();
        SoundManager.playOk();
    };

    // ---------- Экран ГЕЙМПАДА ----------
    function Scene_ArthousePadConfig() {
        this.initialize.apply(this, arguments);
    }
    Scene_ArthousePadConfig.prototype = Object.create(Scene_ArthouseRebind.prototype);
    Scene_ArthousePadConfig.prototype.constructor = Scene_ArthousePadConfig;

    Scene_ArthousePadConfig.prototype._kind = 'pad';

    Scene_ArthousePadConfig.prototype._titleText = function () {
        return 'геймпад!';
    };
    Scene_ArthousePadConfig.prototype._selectHint = function () {
        return 'Стики/крестовина — выбор · кнопка подтверждения — назначить · Esc — назад';
    };
    Scene_ArthousePadConfig.prototype._editHint = function () {
        return 'Нажмите кнопку на геймпаде…  Esc/подтверждение без кнопки — отмена';
    };

    Scene_ArthousePadConfig.prototype._map = function () {
        return ConfigManager.arthousePadMap;
    };
    Scene_ArthousePadConfig.prototype._label = function (idx) {
        return padLabel(idx);
    };

    Scene_ArthousePadConfig.prototype.start = function () {
        Scene_ArthouseRebind.prototype.start.call(this);
        this._onPadConnectedBound = () => {
            this._padFlash = performance.now() + 1500;
            this._refreshSelection();
        };
        window.addEventListener('gamepadconnected', this._onPadConnectedBound, false);
    };

    Scene_ArthousePadConfig.prototype._padPresent = function () {
        const pads = navigator.gamepads || Input.gamepads();
        return !!(pads && pads.some(p => p));
    };

    Scene_ArthousePadConfig.prototype._detectPressedButton = function () {
        const pads = navigator.gamepads || Input.gamepads();
        if (!pads) return -1;
        for (let i = 0; i < pads.length; i++) {
            const pad = pads[i];
            if (!pad) continue;
            for (let j = 0; j < pad.buttons.length; j++) {
                if (pad.buttons[j] && pad.buttons[j].pressed) return j;
            }
        }
        return -1;
    };

    Scene_ArthousePadConfig.prototype.update = function () {
        Scene_ArthouseRebind.prototype.update.call(this);

        // Навигация стиками работает только через стандартный маппинг MZ,
        // пока пользователь не переназначил стрелки — это осознанное
        // ограничение экрана ремапа (иначе залипнем).
        if (this._mode === 'select') {
            if (Input.isRepeated('down'))  this._selectRow(this._selectedAction + 1);
            if (Input.isRepeated('up'))    this._selectRow(this._selectedAction - 1);
            if (Input.isTriggered('ok') || Input.isTriggered('escape') ||
                Input.isTriggered('menu') || Input.isTriggered('cancel')) {
                this._enterEdit();
            }
        } else if (this._mode === 'edit') {
            const btn = this._detectPressedButton();
            if (btn >= 0) {
                const map = this._map();
                const action = this._actions[this._selectedAction];
                map[action] = dedupe(map[action].concat([btn]));
                ConfigManager.save();
                this._refreshValues();
                this._mode = 'select';
                this._refreshSelection();
                SoundManager.playOk();
            }
        }

        if (Input.isTriggered('pageup') || Input.isTriggered('pagedown')) {
            ConfigManager.arthousePadMap = sanitizeMap(null, DEFAULT_PAD_MAP);
            ConfigManager.save();
            this._refreshValues();
            SoundManager.playOk();
        }
    };

    Scene_ArthousePadConfig.prototype._enterEdit = function () {
        Scene_ArthouseRebind.prototype._enterEdit.call(this);
        // ждём, пока все кнопки отпустят, чтобы случайно не назначить
        this._waitRelease = true;
    };

    Scene_ArthousePadConfig.prototype._detectPressedButton = function () {
        const pads = navigator.gamepads || Input.gamepads();
        if (!pads) return -1;
        for (let i = 0; i < pads.length; i++) {
            const pad = pads[i];
            if (!pad) continue;
            for (let j = 0; j < pad.buttons.length; j++) {
                if (pad.buttons[j] && pad.buttons[j].pressed) {
                    if (this._waitRelease) { this._anyPressed = true; }
                    else return j;
                }
            }
        }
        if (this._waitRelease && !this._anyPressed) {
            this._waitRelease = false;
        }
        return -1;
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
            { label: 'полный экран', type: 'fullscreen' },
            { label: 'клавиши...',   type: 'scene', scene: Scene_ArthouseKeyConfig },
            { label: 'геймпад...',   type: 'scene', scene: Scene_ArthousePadConfig }
        ];
        this._rowLabels = [];
        this._rowValues = [];

        const startY = 200, stepY = 78;
        this._startY = startY;
        this._stepY = stepY;

        this._rows.forEach((row, i) => {
            const y = startY + i * stepY;

            const lbl = new PIXI.Text(row.label, {
                fontFamily: FONT_STACK, fontSize: 42, fontWeight: 'bold',
                fill: CONFIG.COL_INK
            });
            lbl.x = 80; lbl.y = y;
            container.addChild(lbl);
            this._rowLabels.push(lbl);

            const val = new PIXI.Text('', {
                fontFamily: FONT_STACK, fontSize: 42, fontWeight: 'bold',
                fill: CONFIG.COL_INK
            });
            val.anchor.set(0.5, 0);
            val.x = W - 240; val.y = y;
            container.addChild(val);
            this._rowValues.push(val);

            // Для строк-ссылок ("клавиши...", "геймпад...") стрелки < > не нужны
            if (row.type === 'scene') return;

            const arrL = new PIXI.Text('<', {
                fontFamily: FONT_STACK, fontSize: 50, fontWeight: 'bold',
                fill: CONFIG.COL_INK
            });
            arrL.anchor.set(0.5, 0);
            arrL.x = W - 400; arrL.y = y - 4;
            container.addChild(arrL);

            const arrR = new PIXI.Text('>', {
                fontFamily: FONT_STACK, fontSize: 50, fontWeight: 'bold',
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
        this._rowValues[4].text = '→ настроить';
        this._rowValues[5].text = this._padPresent() ? 'подключён →' : '→ настроить';
    };

    Scene_ArthouseOptions.prototype._padPresent = function () {
        try {
            const pads = navigator.getGamepads ? navigator.getGamepads() : null;
            return !!(pads && Array.from(pads).some(p => p));
        } catch (e) { return false; }
    };

    Scene_ArthouseOptions.prototype._refreshSelection = function () {
        const y = this._startY + this._selectedRow * this._stepY;

        this._marker.clear();
        this._marker.beginFill(0x000000);
        this._marker.drawRect(40, y + 10, 8, 38);
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
        } else if (this._rows[r] && this._rows[r].type === 'scene') {
            // "клавиши..." / "геймпад..." — открываем вложенный экран
            SceneManager.push(this._rows[r].scene);
            return;
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

        // Обновляем индикатор подключения геймпада ("подключён →")
        this._padPoll = (this._padPoll || 0) + 1;
        if (this._padPoll % 60 === 0) this._refreshValues();
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
            if (my >= y - 10 && my <= y + this._stepY - 8) {
                const row = this._rows[i];
                if (row.type === 'scene') {
                    // клик по строке-ссылке сразу открывает вложенный экран
                    this._selectedRow = i;
                    this._refreshSelection();
                    this._changeValue(+1);
                    return;
                }
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
    window.Scene_ArthouseKeyConfig = Scene_ArthouseKeyConfig;
    window.Scene_ArthousePadConfig = Scene_ArthousePadConfig;

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

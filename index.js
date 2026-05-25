const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion,
    jidNormalizedUser
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const readline = require('readline');

// Base de datos local persistente con autoguardado inmediato
let db = { users: {}, groups: {} };
if (fs.existsSync('./database.json')) {
    try { db = JSON.parse(fs.readFileSync('./database.json', 'utf-8')); } catch (e) { db = { users: {}, groups: {} }; }
}
const saveDB = () => fs.writeFileSync('./database.json', JSON.stringify(db, null, 2));

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

// --- BASE DE DATOS CINEMATOGRÁFICA ---
const MOVIE_POOL = ["Inception", "Interstellar", "Fight Club", "Spirited Away", "Your Name", "Pulp Fiction", "The Dark Knight", "Shutter Island", "The Matrix", "Gladiator"];

// --- TIENDA DE ITEMS GENERALES ---
const SHOP = {
    'cofre_comun': { cost: 1500, desc: '📦 Caja de madera podrida con probabilidad de bicho común.' },
    'cofre_raro': { cost: 4000, desc: '🎁 Caja de plata con criaturas de rango raro garantizadas.' },
    'chocolate': { cost: 200, desc: '🍫 Dulce barato para tus compañeros de rol.' },
    'vinito': { cost: 900, desc: '🍷 Bebida fina para emborrachar a tus citas en el chat.' },
    'navaja': { cost: 1200, desc: '🔪 Hoja oxidada para rajar bolsillos en la calle.' }
};

// --- TIENDA FIJA DE PERSONAJES FICTICIOS (NPCs) ---
const FICTIC_SHOP = {
    'hyunjin': { name: 'Hyunjin (Stray Kids) 🌌', cost: 80000, desc: 'Visual imponente, aura dramática y bailarín estrella.' },
    'felix': { name: 'Felix (Stray Kids) 🐥', cost: 85000, desc: 'Voz ultra gruesa celestial y pecas bañadas en oro.' },
    'bangchan': { name: 'Bang Chan (Stray Kids) 🐺', cost: 95000, desc: 'Líder protector de hombros anchos y desvelado 24/7.' },
    'dahyun': { name: 'Dahyun (Twice) 🦅', cost: 75000, desc: 'Piel de porcelana, carisma tierno y detector de cámaras profesional.' },
    'sana': { name: 'Sana (Twice) 🐹', cost: 78000, desc: 'Energía puramente coquette, ternura letal y encanto natural.' },
    'gojo': { name: 'Gojo Satoru 👁️', cost: 120000, desc: 'Hechicero supremo presumido con los ojos más caros del anime.' },
    'levi': { name: 'Levi Ackerman ⚔️', cost: 110000, desc: 'Obsesivo de la limpieza con cara de pocos amigos y letal con las hojas.' }
};

const PET_POOL = [
    { name: 'Mariposa Coquette 🦋', rarity: 'Comun', dmg: 10 },
    { name: 'Gato Callejero 🐱', rarity: 'Comun', dmg: 15 },
    { name: 'Conejo Esponjoso 🐰', rarity: 'Raro', dmg: 30 }
];

// --- GENERADOR DE HISTORIAS COMBINATORIAS ---
const generarHistoriaRol = (tipo, de, para) => {
    const arrSujetos = [
        "porque es una loca maniática que no se sabe controlar", "frente a todos en la plaza pública dejándolo en ridículo",
        "mientras se le salía un moco de la pura desesperación", "gritando como desquiciado mental sin un ápice de dignidad",
        "dejando en evidencia sus traumas de la infancia frente a todo el grupo", "con cara de retrasado mental absoluto",
        "mientras todo el maldito mundo se le quedaba mirando con asco y lástima", "para ver si así lograba llamar la atención de alguien",
        "con una actitud tan tóxica que hasta el ambiente se puso rancio", "con la cara completamente roja de la pura vergüenza"
    ];
    const arrRemates = [
        "¡Qué maldito espectáculo tan patético! 🤡😶‍🌫️💔😭", "Todos en el chat guardaron silencio de la pura pena ajena... 💀🚶",
        "La humillación fue tan colosal que se escuchó hasta en la esquina. 🪕💥", "Definitivamente necesita terapia psicológica urgente. 🧠🛋️❌",
        "Un aplauso para este pedazo de payaso sin vida social. 🎪👏😂", "Y así es como se pierde la poca dignidad que te quedaba. 📉🚮"
    ];
    
    const randomSujeto = arrSujetos[Math.floor(Math.random() * arrSujetos.length)];
    const randomRemate = arrRemates[Math.floor(Math.random() * arrRemates.length)];
    
    const mapasComandos = {
        'celos': ` acaba de hacerle una escena de celos tóxica a `,
        'matrimonio': ` se arrodilló con las piernas temblorosas para pedirle matrimonio a `,
        'divorcio': ` le tiró los papeles firmados en la cara exigiendo el divorcio inmediato a `,
        'hijo': ` adoptó ilegalmente como su bendición desnutrida a `,
        'abandonar': ` metió en una bolsa de basura y abandonó en un callejón oscuro a `,
        'ignorar': ` le aplicó la ley del hielo de la forma más infantil y ridícula a `,
        'secuestrar': ` amordazó y arrastró directo hacia su sótano húmedo a `,
        'rescatar': ` pagó tres monedas de cobre para rescatar de las garras del peligro a `,
        'enamorar': ` intentó tirar un piropo ordinario para cortejar sin éxito a `,
        'traicion': ` le clavó una puñalada traicionera por la espalda a `,
        'duelo': ` retó a un duelo a muerte usando una resortera oxidada a `,
        'confesar': ` se puso a llorar de rodillas confesándole sus pecados cochinos a `,
        'esclavo': ` le puso un collar de sumisión absoluta en el cuello a `,
        'liberar': ` le dio una patada de despedida otorgándole la libertad a `,
        'admirar': ` se puso a babeear de rodillas admirando la belleza inalcanzable de `,
        'acosar': ` persigue de forma obsesiva e incómoda por todos los rincones a `,
        'despreciar': ` miró de arriba a abajo con una cara de tremendo asco a `,
        'bautizar': ` le impuso un apodo denigrante que llevará por el resto de sus días a `,
        'proteger': ` saltó al frente como escudo humano ridículo para defender a `,
        'vender': ` le puso precio de remate en el mercado negro de órganos a `,
        'veneno': ` deslizó unas gotas de un líquido verde sospecho en la copa de `,
        'curar': ` le escupió un ungüento místico en la herida para sanar a `,
        'invocar': ` dibujó un pentagrama en el piso invocando de forma satánica a `,
        'petfight': ` soltó a su bestia salvaje rabiosa para que despedazara a la mascota de `,
        'petrobar': ` mandó a su mariposa entrenada a sacarle cosas de los bolsillos a `,
        'regalar': ` le arrojó un fajo de billetes arrugados en la cara a `,
        'daritem': ` le cedió un objeto polvoriento de su mochila a `
    };

    const conector = mapasComandos[tipo] || ` realizó una acción interactiva con `;
    return `*Acción de Rol Coquette Dinámica*\n\n${de}${conector}${para} ${randomSujeto}. ${randomRemate}`;
};

// --- BANCO DE FRASES TOTALMENTE ALEATORIAS PARA COMANDOS ECONÓMICOS ---
const OpcionesMensajes = {
    work: [
        "Aguantaste los gritos de tu supervisor gordo en la oficina.",
        "Te pusiste a ordenar cajas pesadas en el almacén bajo el sol.",
        "Terminaste de programar un script en Termux para una empresa local.",
        "Te tocó atender a clientes insoportables en el mostrador todo el día.",
        "Hiciste horas extra limpiando el desastre que dejaron en el evento de rol."
    ],
    slut: [
        "🥵 Te pusiste en cuatro usando tus mejores encajes rosas y cobraste lindo.",
        "💅 Te paraste en la esquina coquette, un magnate paró su auto y te dejó un fajo.",
        "💋 Cumpliste los caprichos de un usuario consentidor en privado.",
        "✨ Bailaste en el tubo del club nocturno recibiendo lluvias de billetes.",
        "🎀 Fuiste la compañía de un sugar daddy adinerado durante una cena lujosa."
    ],
    slut_fail: [
        "🤮 El tipo olía espantoso a cebolla. Te arrastró por el piso y saliste corriendo.",
        "👮 Te cayó una patrulla en plena faena y tuviste que pagarle al oficial para que no te metiera al calabozo.",
        "🤡 El cliente resultó ser un tacaño estafador y te dejó plantada en el hotel.",
        "💔 Te dio un calambre horrible a mitad del acto y te echaron a la calle sin un peso.",
        "🩹 Te tropezaste con tus tacones altos y terminaste en el suelo con la dignidad rota."
    ],
    hospital: [
        "🏥 Limpiaste fluidos extraños de pacientes moribundos en urgencias.",
        "🏥 Te tocó bañar a un viejo cascarrabias que te insultó en tres idiomas.",
        "🏥 Organizaste el inventario de la morgue a mitad de la noche a oscuras.",
        "🏥 Ayudaste en una cirugía de emergencia rellenando papeles aburridos."
    ],
    oficina: [
        "🗄️ Le lamiste las boots al director corporativo para asegurar tu puesto.",
        "🗄️ Engrapaste 500 folios de contratos ranciados sin derecho a descansar.",
        "🗄️ Te echaste la culpa por un error del jefe para ganarte su simpatía y un bono.",
        "🗄️ Serviste café hirviendo en la junta directiva aguantando miradas pesadas."
    ],
    sicario: [
        "🔫 Vaciaste un cargador completo en el pecho de un deudor moroso.",
        "🔫 Saboteaste los frenos del auto de un rival del bando contrario.",
        "🔫 Eliminaste a un objetivo clave desde un tejado usando un rifle de precisión.",
        "🔫 Le diste una lección silenciosa a alguien que andaba hablando de más en el chat."
    ],
    limpiar: [
        "🪠 Raspaste suciedad acumulada de retretes públicos con un cepillo roto.",
        "🪠 Destacaste las tuberías principales del drenaje municipal cubierto de lodo.",
        "🪠 Limpiaste los vidrios de un rascacielos colgado de una cuerda floja.",
        "🪠 Recogiste toda la basura podrida del callejón del mercado negro."
    ],
    thief: [
        "🥷 Le sacaste limpiamente la billetera a un anciano distraído en la plaza.",
        "🥷 Diste un baje rápido a una mochila descuidada en el transporte público.",
        "🥷 Te colaste por la ventana de una casa y te llevaste los ahorros de la mesa.",
        "🥷 Le arrebataste una cadena de oro a un cheto descuidado en el callejón."
    ],
    thief_fail: [
        "🚓 Te agarró la patrulla infraganti y te acomodó las costillas a piazos.",
        "🏃 El sujeto se dio cuenta, sacó un gas pimienta y te dejó llorando en la acera.",
        "🤡 Corriste tan rápido que se te cayó tu propia billetera al suelo intentando escapar.",
        "🐶 Te saltó un perro pitbull guardián y te dejó los pantalones hechos jirones."
    ],
    heist: [
        "💎 ¡EL GRAN ATRACO FUNCIONÓ! Entraron con máscaras y vaciaron las cajas fuertes.",
        "💎 Hackearon las cámaras de seguridad y abrieron la bóveda blindada en silencio.",
        "💎 Interceptaron el camión de caudales en la carretera y se llevaron los contenedores rosa."
    ],
    heist_fail: [
        "🚨 Activaste los sensores láser con tu gordo trasero y se cerraron las compuertas.",
        "🚔 SWAT Te acorraló el equipo táctico y tuviste que dejar el botín tirado para salvar el pellejo.",
        "🧨 El explosivo C4 falló y la onda expansiva te mandó directo al suelo inconsciente."
    ],
    monthly: [
        "👑 El sindicato internacional de rol te envió tu maletín de inversor VIP.",
        "🌸 Recibiste la herencia perdida de tu tía abuela coquette millonaria de Europa.",
        "📦 Te llegó un contenedor entero de contrabando premium libre de impuestos.",
        "🏦 Expropiaste fondos gubernamentales olvidados mediante un exploit avanzado."
    ]
};

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        log: pino({ level: 'silent' }),
        auth: state,
        browser: ['Linux', 'Chrome', '20.0.04'],
        printQRInTerminal: false
    });

    if (!sock.authState.creds.registered) {
        const phoneNumber = await question('\nIntroduce tu número de WhatsApp con código de país:\n');
        const code = await sock.requestPairingCode(phoneNumber.trim());
        console.log(`\n🔑 TU CÓDIGO DE EMPAREJAMIENTO ES: ${code}\n`);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('\n✅ ¡Bot conectado con éxito a WhatsApp y libre de errores!\n');
            db.owner = jidNormalizedUser(sock.user.id);
            saveDB();
        }
    });

    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message) return;
            const type = Object.keys(mek.message)[0];
            const from = mek.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const sender = jidNormalizedUser(isGroup ? mek.key.participant : from);
            
            const body = (type === 'conversation') ? mek.message.conversation : 
                         (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text : '';
            
            if (!body.startsWith('#')) return;

            const args = body.trim().split(/ +/);
            const command = args.shift().toLowerCase();
            const text = args.join(' ');

            if (!db.users[sender]) {
                db.users[sender] = { 
                    wallet: 2000, bank: 0, debt: 0,
                    name: 'Sin registrar', age: 'No especificada', gender: 'No especificado',
                    marriedWith: 'Soltero/a', desc: 'Sin biografía.', title: 'Mendigo',
                    pets: [], inventory: {}, crimes: 0, dailyStreak: 0, lastDaily: 0, lastMonthly: 0,
                    propiedades: [], ownerOriginal: sender
                };
                for (let k in SHOP) db.users[sender].inventory[k] = 0;
            }
            if (isGroup && !db.groups[from]) {
                db.groups[from] = { currency: '¥' };
                saveDB();
            }

            const user = db.users[sender];
            if (user.lastMonthly === undefined) user.lastMonthly = 0;
            if (!user.propiedades) user.propiedades = [];
            if (!user.ownerOriginal) user.ownerOriginal = sender;

            const groupSymbol = isGroup ? db.groups[from].currency : '¥';
            const isOwner = sender === jidNormalizedUser(db.owner);

            let isBotAdmin = false, isUserAdmin = false, participants = [];
            if (isGroup) {
                const groupMetadata = await sock.groupMetadata(from);
                participants = groupMetadata.participants;
                const botJid = jidNormalizedUser(sock.user.id);
                isBotAdmin = participants.some(p => jidNormalizedUser(p.id) === botJid && (p.admin === 'admin' || p.admin === 'superadmin'));
                isUserAdmin = participants.some(p => jidNormalizedUser(p.id) === sender && (p.admin === 'admin' || p.admin === 'superadmin'));
            }

            const reply = async (txt) => {
                await sock.sendMessage(from, { text: txt, mentions: [sender] }, { quoted: mek });
            };

            const getTarget = () => {
                let t = mek.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || (args[0] && args[0].replace('@', '') + '@s.whatsapp.net');
                return t ? jidNormalizedUser(t) : null;
            };

            const getRandomPhrase = (arr) => arr[Math.floor(Math.random() * arr.length)];

            // ==========================================
            // MENÚ PRINCIPAL ACTUALIZADO CON NUEVOS CMDS
            // ==========================================
            if (command === '#help' || command === '#menu') {
                const tagUser = `@${sender.split('@')[0]}`;
                let menuTxt = `❀•°•═════ஓ๑♡๑ஓ═════•°•❀\n`;
                menuTxt += `  𝓧ο𝓵𝓪 𝓑𝓲𝓮𝓷𝓿𝓮𝓷𝓲𝓭ο 𝓪𝓵 𝓫ο𝓽 ${tagUser}\n`;
                menuTxt += `❀•°•═════ஓ๑♡๑ஓ═════•°•❀\n\n`;
                
                menuTxt += `🛒 *𝓛𝓪𝓫ο labors 𝓔𝓬ο𝓷ό𝓶𝓲𝓬𝓪𝓼 𝔂 𝓓𝓮𝓼𝓪𝓯𝓲́ο𝓼*\n`;
                menuTxt += `» \`#w\` ➔ Trabaja duro en empleos variados.\n`;
                menuTxt += `» \`#slut\` ➔ Vende caricias de forma coquette.\n`;
                menuTxt += `» \`#thief\` ➔ Roba carteras a los descuidados.\n`;
                menuTxt += `» \`#mine\` ➔ Pica piedra en la mina profunda.\n`;
                menuTxt += `» \`#farm\` ➔ Cosecha vegetales en el campo.\n`;
                menuTxt += `» \`#fish\` ➔ Pesca criaturas en el lago radiactivo.\n`;
                menuTxt += `» \`#scavenge\` ➔ Busca chatarra útil en la basura.\n`;
                menuTxt += `» \`#heist\` ➔ Planea un asalto a un camión blindado.\n`;
                menuTxt += `» \`#beg\` ➔ Pide limosna con ojos de lástima.\n`;
                menuTxt += `» \`#bounty\` ➔ Caza a un prófugo de la justicia.\n`;
                menuTxt += `» \`#hospital\` ➔ Limpia camillas en urgencias.\n`;
                menuTxt += `» \`#oficina\` ➔ Haz papeleo aburrido para un bono.\n`;
                menuTxt += `» \`#sicario\` ➔ Elimina un objetivo por encargo líquido.\n`;
                menuTxt += `» \`#limpiar\` ➔ Desataca cañerías públicas por monedas.\n`;
                menuTxt += `» \`#bal\` ➔ Consulta cuánto dinero llevas encima.\n\n`;

                menuTxt += `🏦 *𝓑𝓪𝓷𝓬ο 𝓒𝓮𝓷𝓽𝓻𝓪𝓵 𝓨 𝓣𝓻𝓪𝓷𝓼𝓯𝓮𝓻𝓮𝓷𝓬𝓲𝓪𝓼*\n`;
                menuTxt += `» \`#banco\` ➔ Revisa tus fondos resguardados.\n`;
                menuTxt += `» \`#d [monto/all]\` ➔ Deposita ganancias a salvo.\n`;
                menuTxt += `» \`#retirar [monto/all]\` ➔ Saca efectivo para gastar.\n`;
                menuTxt += `» \`#prestar [monto]\` ➔ Pide un crédito bancario urgente.\n`;
                menuTxt += `» \`#pagar [monto]\` ➔ Liquida tus cuentas de deudor.\n`;
                menuTxt += `» \`#pay [@tag] [monto]\` ➔ Transfiere efectivo directo a un amigo.\n\n`;

                menuTxt += `👥 *𝓜𝓮𝓻𝓬𝓪𝓭𝓸 𝓝𝓮𝓰𝓻𝓸: 𝓣𝓻𝓪́𝓯𝓲𝓬𝓸 𝓭𝓮 𝓟𝓮𝓻𝓼𝓸𝓷𝓪𝓳𝓮𝓼*\n`;
                menuTxt += `» \`#tiendajin\` ➔ Ver catálogo de personajes ficticios en venta.\n`;
                menuTxt += `» \`#buyjin [id]\` ➔ Comprar un personaje ficticio de la tienda.\n`;
                menuTxt += `» \`#selljin [id]\` ➔ Re-vender un personaje a la tienda por el 50%.\n`;
                menuTxt += `» \`#compraruser [@tag] [precio]\` ➔ Ofertar para comprar a un usuario real.\n`;
                menuTxt += `» \`#venderuser [@tag] [@comprador] [precio]\` ➔ Vender un esclavo que poseas.\n`;
                menuTxt += `» \`#propiedades\` ➔ Lista de personajes y usuarios bajo tu dominio.\n\n`;

                menuTxt += `🥷 *𝓒𝓻𝓲𝓶𝓮𝓷 𝔂 𝓐𝓵𝓽ο 𝓡𝓲𝓮𝓼𝓰ο*\n`;
                menuTxt += `» \`#falsificar\` ➔ Imprime billetes falsos.\n`;
                menuTxt += `» \`#pirateria\` ➔ Distribuye copias ilegales.\n`;
                menuTxt += `» \`#contrabando\` ➔ Cruza mercancía rosa sin pagar.\n`;
                menuTxt += `» \`#estafa\` ➔ Vende cursos falsos a los ingenuos.\n`;
                menuTxt += `» \`#asalto\` ➔ Entra a una tienda con navaja oxidada.\n`;
                menuTxt += `» \`#hackear\` ➔ Rompe servidores de una corporación.\n\n`;

                menuTxt += `🃏 *𝓙𝓾𝓮𝓰ο𝓼 𝓭𝓮 𝓐𝔃𝓪𝓻 𝔂 𝓣𝓻𝓲𝓿𝓲𝓪𝓼*\n`;
                menuTxt += `» \`#ruleta\` / \`#suerte\` / \`#dados\` / \`#tragamonedas\` / \`#blackjack\`\n\n`;

                menuTxt += `🎭 *𝓘𝓷𝓽𝓮𝓻𝓪𝓬𝓬𝓲𝓸́𝓷 𝓢𝓸𝓬𝓲𝓪𝓵 𝓭𝓮 𝓡𝓸𝓵*\n`;
                menuTxt += `» \`#celos\` / \`#matrimonio\` / \`#divorcio\` / \`#hijo\` / \`#secuestrar\` / \`#vender\`\n\n`;

                menuTxt += `👤 *𝓟𝓮𝓻𝓯𝓲𝓵 𝔂 𝓢𝓾𝓫𝓼𝓲𝓭𝓲𝓸𝓼*\n`;
                menuTxt += `» \`#perfil\` / \`#mochila\` / \`#diario\` / \`#monthly\` ➔ ¡Subsidio mensual masivo de 30 días!\n`;
                menuTxt += `❀•°•═════ஓ๑♡๑ஓ═════•°•❀`;
                
                await sock.sendMessage(from, { text: menuTxt, mentions: [sender] }, { quoted: mek });
            }

            // ==========================================
            // COMANDO DE TRANSFERENCIA DIRECTA (#pay)
            // ==========================================
            else if (command === '#pay') {
                let target = getTarget();
                if (!target) return reply('❌ Etiqueta al usuario que recibirá el capital. Ej: `#pay @tag 5000`');
                if (target === sender) return reply('🖕 No puedes transferirte a ti mismo, gracioso.');

                let dineroStr = args.find(a => !a.includes('@') && !isNaN(a));
                let monto = parseInt(dineroStr);

                if (isNaN(monto) || monto <= 0) return reply('❌ Especifica un monto numérico válido mayor a cero.');
                if (user.wallet < monto) return reply('❌ No tienes suficiente efectivo en mano.');

                if (!db.users[target]) {
                    db.users[target] = { wallet: 2000, bank: 0, debt: 0, name: 'Sin registrar', pets: [], inventory: {}, propiedades: [], ownerOriginal: target };
                }

                user.wallet -= monto;
                db.users[target].wallet += monto;
                saveDB();

                await sock.sendMessage(from, {
                    text: `💸 *TRANSFERENCIA EXITOSA* 💸\n\n👤 *Origen:* @${sender.split('@')[0]}\n🎯 *Destino:* @${target.split('@')[0]}\n💰 *Monto:* ${groupSymbol}${monto} enviados en efectivo de forma directa.`,
                    mentions: [sender, target]
                }, { quoted: mek });
            }

            // ==========================================
            // MERCADO DE PERSONAJES FICTICIOS (NPCs)
            // ==========================================
            else if (command === '#tiendajin') {
                let txt = `🌌 *MERCADO DE PERSONAJES FICTICIOS* 🌌\n`;
                txt += `Usa \`#buyjin [id]\` para comprarlos y sumarlos a tus propiedades.\n\n`;
                for (const [id, item] of Object.entries(FICTIC_SHOP)) {
                    txt += `🆔 *\`${id}\`* ➔ *${item.name}*\n💰 Precio: ${groupSymbol}${item.cost}\n✨ Desc: _${item.desc}_\n\n`;
                }
                reply(txt);
            }

            else if (command === '#buyjin') {
                let id = text.trim().toLowerCase();
                if (!FICTIC_SHOP[id]) return reply('❌ Esa ID de personaje no existe en la cartelera. Usa `#tiendajin`');
                
                if (user.propiedades.some(p => p.id === id)) return reply('❌ Ya posees a este personaje bajo tu dominio.');
                if (user.wallet < FICTIC_SHOP[id].cost) return reply(`❌ Fondos insuficientes. Requieres ${groupSymbol}${FICTIC_SHOP[id].cost} en mano.`);

                user.wallet -= FICTIC_SHOP[id].cost;
                user.propiedades.push({ id: id, name: FICTIC_SHOP[id].name, tipo: 'ficticio' });
                saveDB();

                reply(`✨ ¡COMPRA EXITOSA! Has comprado a *${FICTIC_SHOP[id].name}*. Ahora es de tu propiedad privada y puedes presumirlo.`);
            }

            else if (command === '#selljin') {
                let id = text.trim().toLowerCase();
                let index = user.propiedades.findIndex(p => p.id === id && p.tipo === 'ficticio');
                if (index === -1) return reply('❌ No tienes ese personaje en tu lista de propiedades.');

                let reembolso = Math.floor(FICTIC_SHOP[id].cost * 0.5);
                user.wallet += reembolso;
                user.propiedades.splice(index, 1);
                saveDB();

                reply(`⚖️ Vendiste a *${FICTIC_SHOP[id].name}* de regreso al mercado negro por un valor de remate de *${groupSymbol}${reimbolso}*.`);
            }

            // ==========================================
            // COMPRA/VENTA DE USUARIOS REALES (ESCLAVOS)
            // ==========================================
            else if (command === '#compraruser') {
                let target = getTarget();
                if (!target) return reply('❌ Etiqueta al usuario real que deseas comprar. Ej: `#compraruser @tag 30000`');
                if (target === sender) return reply('❌ No puedes comprar tu propia libertad de esta forma.');

                let precioStr = args.find(a => !a.includes('@') && !isNaN(a));
                let precio = parseInt(precioStr);

                if (isNaN(precio) || precio <= 0) return reply('❌ Coloca el precio de oferta. Ej: `#compraruser @tag 40000`');
                if (user.wallet < precio) return reply('❌ No tienes tanto efectivo en mano para solventar el trato.');

                // Validar si el usuario ya tiene un dueño
                let dueñoActual = Object.keys(db.users).find(u => db.users[u].propiedades?.some(p => p.id === target));
                
                if (dueñoActual) {
                    return reply(`❌ Ese usuario ya es propiedad privada de @${dueñoActual.split('@')[0]}. Debes convencerlo de que te lo venda usando \`#venderuser\`.`);
                }

                if (!db.users[target]) {
                    db.users[target] = { wallet: 2000, bank: 0, debt: 0, name: 'Sin registrar', pets: [], inventory: {}, propiedades: [], ownerOriginal: target };
                }

                user.wallet -= precio;
                user.propiedades.push({ id: target, name: db.users[target].name !== 'Sin registrar' ? db.users[target].name : `@${target.split('@')[0]}`, tipo: 'real' });
                saveDB();

                await sock.sendMessage(from, {
                    text: `⛓️ *NUEVA ADQUISICIÓN EN EL CHAT* ⛓️\n\nEl usuario @${target.split('@')[0]} ha sido comprado como esclavo absoluto por @${sender.split('@')[0]} por la suma total de *${groupSymbol}${precio}*.\n\n_¡Ahora pasa a la lista de propiedades de su nuevo amo!_`,
                    mentions: [sender, target]
                }, { quoted: mek });
            }

            else if (command === '#venderuser') {
                let target = getTarget(); // El esclavo que voy a vender
                if (!target) return reply('❌ Indica el esclavo que vas a vender y quién te lo compra. Ej: `#venderuser @esclavo @comprador 25000`');

                // Encontrar las menciones correctas excluyendo al bot o al remitente
                let menciones = mek.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                let comprador = menciones.find(m => m !== target && m !== sender);
                if (!comprador) return reply('❌ Debes etiquetar también al comprador en el comando.');

                let precioStr = args.find(a => !a.includes('@') && !isNaN(a));
                let precio = parseInt(precioStr);

                if (isNaN(precio) || precio <= 0) return reply('❌ Especifica el valor acordado de la transacción.');

                // Verificar si el remitente realmente posee a ese esclavo
                let index = user.propiedades.findIndex(p => p.id === target && p.tipo === 'real');
                if (index === -1) return reply('❌ Ese usuario no está en tu lista de propiedades.');

                if (!db.users[comprador]) return reply('❌ El comprador no está registrado en el sistema del bot.');
                if (db.users[comprador].wallet < precio) return reply('❌ El comprador no dispone del efectivo necesario en su mano.');

                // Realizar traspaso de capital y de propiedad
                db.users[comprador].wallet -= precio;
                user.wallet += precio;

                // Quitarle el esclavo al vendedor y dárselo al comprador
                let esclavoData = user.propiedades.splice(index, 1)[0];
                db.users[comprador].propiedades.push(esclavoData);
                saveDB();

                await sock.sendMessage(from, {
                    text: `⚖️ *TRÁFICO DE ESCLAVOS CONFIRMADO* ⚖️\n\nAmos del chat, el traspaso se concretó:\n\n👤 *Vendedor:* @${sender.split('@')[0]}\n🤝 *Comprador:* @${comprador.split('@')[0]}\n⛓️ *Propiedad Transferida:* @${target.split('@')[0]}\n💰 *Costo comercial:* ${groupSymbol}${precio}`,
                    mentions: [sender, comprador, target]
                }, { quoted: mek });
            }

            // ==========================================
            // COMANDO PARA VER MIS ADQUISICIONES
            // ==========================================
            else if (command === '#propiedades') {
                if (user.propiedades.length === 0) {
                    return reply('💸 No posees activos, esclavos reales ni personajes ficticios comprados aún. ¡Empieza a gastar en el mercado negro!');
                }

                let txt = `🏰 *CATÁLOGO DE PROPIEDADES PRIVADAS* 🏰\n`;
                txt += `Lista de activos bajo el poder de: @${sender.split('@')[0]}\n\n`;

                let ficticios = user.propiedades.filter(p => p.tipo === 'ficticio');
                let reales = user.propiedades.filter(p => p.tipo === 'real');

                if (ficticios.length > 0) {
                    txt += `🎭 *Personajes Ficticios VIP:*\n`;
                    ficticios.forEach((p, i) => { txt += `  » \`${p.id}\` - ${p.name}\n`; });
                    txt += `\n`;
                }

                if (reales.length > 0) {
                    txt += `⛓️ *Usuarios del Chat Dominados:*\n`;
                    reales.forEach((p, i) => { txt += `  » ${p.name}\n`; });
                }

                await sock.sendMessage(from, { text: txt, mentions: [sender, ...reales.map(r => r.id)] }, { quoted: mek });
            }

            // ==========================================
            // LOGICA DEL BANCO COMPLEMENTO
            // ==========================================
            else if (command === '#banco') {
                const tagUser = `@${sender.split('@')[0]}`;
                let bankTxt = `┅┅┅┅┅┅┅༻❁༺┅┅┅┅┅┅┅\n`;
                bankTxt += `  𝓦𝓮𝓵𝓬𝓸𝓶e 𝓽𝓸 𝓽𝓱e 𝓫𝓪𝓷𝓴 ${tagUser}\n\n`;
                bankTxt += ` 𝓓𝓲𝓷𝓮𝓻ο 𝓐𝓬𝓽𝓾𝓪𝓵: ${groupSymbol}${user.bank}\n\n`;
                bankTxt += ` 𝓓𝓮𝓫𝓮𝓼: ${groupSymbol}${user.debt}\n`;
                bankTxt += `┅┅┅┅┅┅┅༻❁༺┅┅┅┅┅┅┅\n`;
                reply(bankTxt);
            }

            else if (command === '#d') {
                if (!text) return reply('❌ Indica monto o `#d all`');
                let cant = text.trim().toLowerCase() === 'all' ? user.wallet : parseInt(text);
                if (isNaN(cant) || cant <= 0 || user.wallet < cant) return reply('❌ Fondos insuficientes en mano.');
                user.wallet -= cant; user.bank += cant; saveDB();
                reply(`🏦 Depositaste *${groupSymbol}${cant}* en la bóveda.`);
            }

            else if (command === '#retirar') {
                if (!text) return reply('❌ Indica monto o `#retirar all`');
                let cant = text.trim().toLowerCase() === 'all' ? user.bank : parseInt(text);
                if (isNaN(cant) || cant <= 0 || user.bank < cant) return reply('❌ No tienes ese capital resguardado.');
                user.bank -= cant; user.wallet += cant; saveDB();
                reply(`🏧 Retiraste *${groupSymbol}${cant}* al efectivo.`);
            }

            else if (command === '#prestar') {
                const monto = parseInt(text);
                if (isNaN(monto) || monto <= 0 || monto > 50000) return reply('❌ Préstamos de hasta 50,000 capitales.');
                if (user.debt > 0) return reply(`🖕 El banco no te fía más por moroso.`);
                user.bank += monto; user.debt += Math.floor(monto * 1.15); saveDB();
                reply(`💰 Crédito aprobado: *${groupSymbol}${monto}* (En banco). Debes *${groupSymbol}${user.debt}*.`);
            }

            else if (command === '#pagar') {
                const monto = parseInt(text);
                if (isNaN(monto) || monto <= 0 || user.wallet < monto || user.debt <= 0) return reply('❌ Operación financiera inválida.');
                let abono = Math.min(monto, user.debt);
                user.wallet -= abono; user.debt -= abono; saveDB();
                reply(`✅ Liquidaste *${groupSymbol}${abono}* de tu estado deudor.`);
            }

            // ==========================================
            // SECCIÓN PERFIL COMPLETO
            // ==========================================
            else if (command === '#perfil') {
                const tagUser = `@${sender.split('@')[0]}`;
                let txt = `┅┅┅┅┅┅┅༻❁༺┅┅┅┅┅┅┅\n`;
                txt += `  𝓤𝓼𝓮𝓻 𝓟𝓻ο𝓯𝓲𝓵𝓮: ${tagUser}\n\n`;
                txt += ` 𝓝ο𝓶𝓫𝓻𝓮: ${user.name}\n`;
                txt += ` 𝓔𝓭𝓪𝓭: ${user.age}\n`;
                txt += ` 𝓢𝓮𝔁ο: ${user.gender}\n`;
                txt += ` 𝓓𝓮𝓼𝓬𝓻𝓲𝓹𝓬𝓲𝓸́𝓷: ${user.title}\n`;
                txt += ` 𝓔𝓯ectivo: ${groupSymbol}${user.wallet}\n`;
                txt += ` 𝓑𝓪𝓷𝓬ο: ${groupSymbol}${user.bank}\n`;
                txt += ` 𝓒𝓪𝓼𝓪𝓭ο/𝓪 𝓬ο𝓷: ${user.marriedWith}\n`;
                txt += ` 𝓑𝓲ο𝓰𝓻𝓪𝓯𝓲́𝓪: ${user.desc}\n`;
                txt += `┅┅┅┅┅┅┅༻❁༺┅┅┅┅┅┅┅`;
                reply(txt);
            }

            else if (command === '#setname') { if (!text) return; user.name = text.trim(); saveDB(); reply('✨ Nombre actualizado.'); }
            else if (command === '#setedad') { if (!text || isNaN(text)) return; user.age = `${parseInt(text)} años`; saveDB(); reply('✨ Edad guardada.'); }
            else if (command === '#setsexo') { if (!text) return; user.gender = text.trim(); saveDB(); reply('✨ Sexo modificado.'); }
            else if (command === '#setdesc') { if (!text) return; user.desc = text.trim(); saveDB(); reply('✨ Biografía indexada.'); }
            else if (command === '#titulo') { if (!text) return; user.title = text.trim(); saveDB(); reply('✨ Título premium guardado.'); }

            // ==========================================
            // COMANDOS DE ROL INTERACTIVO
            // ==========================================
            const cmdsRol = [
                'celos', 'matrimonio', 'divorcio', 'hijo', 'abandonar', 'ignorar', 'secuestrar', 'rescatar',
                'enamorar', 'traicion', 'duelo', 'confesar', 'esclavo', 'liberar', 'admirar', 'acosar',
                'despreciar', 'bautizar', 'proteger', 'vender', 'veneno', 'curar', 'invocar', 'regalar', 'daritem'
            ];
            
            if (cmdsRol.includes(command.substring(1))) {
                let target = getTarget();
                if (!target) return reply('❌ Menciona o etiqueta a un usuario.');
                const tagDe = `@${sender.split('@')[0]}`;
                const tagPara = `@${target.split('@')[0]}`;
                
                if (command === '#matrimonio') { user.marriedWith = tagPara; db.users[target].marriedWith = tagDe; saveDB(); }
                if (command === '#divorcio') { user.marriedWith = 'Soltero/a'; db.users[target].marriedWith = 'Soltero/a'; saveDB(); }
                
                let historia = generarHistoriaRol(command.substring(1), tagDe, tagPara);
                await sock.sendMessage(from, { text: historia, mentions: [sender, target] }, { quoted: mek });
            }

            // ==========================================
            // LABORES ECONÓMICAS Y CRIMEN
            // ==========================================
            else if (command === '#w' || command === '#work') {
                const gana = Math.floor(Math.random() * 3000) + 1000; user.wallet += gana; saveDB();
                const frase = getRandomPhrase(OpcionesMensajes.work);
                reply(`💼 ${frase}\n*¡Ganaste +${groupSymbol}${gana}!*`);
            }
            else if (command === '#slut') {
                if (Math.random() > 0.4) {
                    const gana = Math.floor(Math.random() * 8000) + 3000; user.wallet += gana; saveDB();
                    const frase = getRandomPhrase(OpcionesMensajes.slut);
                    reply(`${frase}\n*¡Ganaste +${groupSymbol}${gana}!*`);
                } else {
                    const pierde = Math.floor(Math.random() * 3000) + 1000; user.wallet = Math.max(0, user.wallet - pierde); saveDB();
                    const frase = getRandomPhrase(OpcionesMensajes.slut_fail);
                    reply(`${frase}\n*Perdiste -${groupSymbol}${pierde}*`);
                }
            }
            else if (command === '#hospital') {
                const gana = Math.floor(Math.random() * 5000) + 1500; user.wallet += gana; saveDB();
                const frase = getRandomPhrase(OpcionesMensajes.hospital);
                reply(`${frase}\n*Ganancia: +${groupSymbol}${gana}*`);
            }
            else if (command === '#oficina') {
                const gana = Math.floor(Math.random() * 4500) + 1000; user.wallet += gana; saveDB();
                const frase = getRandomPhrase(OpcionesMensajes.oficina);
                reply(`${frase}\n*Bono recibido: +${groupSymbol}${gana}*`);
            }
            else if (command === '#sicario') {
                const gana = Math.floor(Math.random() * 12000) + 4000; user.wallet += gana; saveDB();
                const frase = getRandomPhrase(OpcionesMensajes.sicario);
                reply(`${frase}\n*Pago líquido: +${groupSymbol}${gana}*`);
            }
            else if (command === '#limpiar') {
                const gana = Math.floor(Math.random() * 2000) + 500; user.wallet += gana; saveDB();
                const frase = getRandomPhrase(OpcionesMensajes.limpiar);
                reply(`${frase}\n*Recompensa: +${groupSymbol}${gana}*`);
            }
            else if (command === '#thief') {
                if (Math.random() > 0.6) {
                    const g = Math.floor(Math.random() * 7000) + 2000; user.wallet += g; saveDB();
                    const frase = getRandomPhrase(OpcionesMensajes.thief);
                    reply(`${frase}\n*¡Robaste +${groupSymbol}${g}!*`);
                } else {
                    user.wallet = Math.max(0, user.wallet - 3000); saveDB();
                    const frase = getRandomPhrase(OpcionesMensajes.thief_fail);
                    reply(`${frase}\n*Multa / Pérdida: -${groupSymbol}3000*`);
                }
            }
            else if (command === '#heist') {
                if (Math.random() > 0.75) {
                    user.wallet += 25000; saveDB();
                    const frase = getRandomPhrase(OpcionesMensajes.heist);
                    reply(`${frase}\n*¡BOTÍN COLOSAL: +${groupSymbol}25000!*`);
                } else {
                    user.wallet = Math.max(0, user.wallet - 8000); saveDB();
                    const frase = getRandomPhrase(OpcionesMensajes.heist_fail);
                    reply(`${frase}\n*Consecuencias: -${groupSymbol}8000*`);
                }
            }
            
            else if (command === '#mine') { 
                const mineral = getRandomPhrase(["Diamante Rosa", "Rubí Coquette", "Bloque de Carbón", "Plata Pura"]);
                const g = 2500; user.wallet += g; saveDB(); 
                reply(`⛏️ Picaste profundo en la mina y extrajiste un *${mineral}*.\n*¡Vendido por +${groupSymbol}${g}*`); 
            }
            else if (command === '#farm') { 
                const vegetal = getRandomPhrase(["Zanahorias de azúcar", "Flores de cerezo", "Frutillas silvestres"]);
                const g = 2200; user.wallet += g; saveDB(); 
                reply(`🚜 Cosechaste un lote de *${vegetal}* cubierto de estiércol.\n*Ganancia: +${groupSymbol}${g}*`); 
            }
            else if (command === '#fish') { 
                const pez = getRandomPhrase(["Pez de tres ojos", "Salmón brillante", "Bota vieja mohosa"]);
                const g = 1800; user.wallet += g; saveDB(); 
                reply(`🎣 Tiraste la caña al lago y sacaste un *${pez}*.\n*Vendido al mercado por +${groupSymbol}${g}*`); 
            }
            else if (command === '#scavenge') { 
                const chatarra = getRandomPhrase(["Un corsé roto", "Una lata de soda vacía", "Un radio antiguo oxidado"]);
                const g = 1200; user.wallet += g; saveDB(); 
                reply(`🗑️ Te clavaste al basurero municipal y rescataste *${chatarra}*.\n*Te dieron +${groupSymbol}${g}*`); 
            }
            else if (command === '#beg') { const g = 300; user.wallet += g; saveDB(); reply(`🥺 Mendigaste en la acera pública poniendo ojos de lástima y te aventaron *+${groupSymbol}${g}* en la frente.`); }
            else if (command === '#bounty') { const g = 9000; user.wallet += g; saveDB(); reply(`🤠 Noqueaste a un prófugo federal buscado por la espalda.\n*Recompensa cobrada: +${groupSymbol}${g}*`); }
            
            // Crímenes Especiales
            const ejecutarCrimenRapido = (msgGana, msgPierde, cashGana, cashPierde) => {
                if (Math.random() > 0.45) {
                    user.wallet += cashGana; saveDB(); reply(`🔥 ${msgGana} *+${groupSymbol}${cashGana}*`);
                } else {
                    user.wallet = Math.max(0, user.wallet - cashPierde); saveDB(); reply(`🚓 ${msgPierde} *-${groupSymbol}${cashPierde}*`);
                }
            };
            if (command === '#falsificar') ejecutarCrimenRapido("Imprimiste billetes idénticos en tu sótano.", "La máquina explotó llenándote de tinta.", 4000, 1500);
            else if (command === '#pirateria') ejecutarCrimenRapido("Subiste películas piratas y monetizaste los anuncios.", "Te tiraron las páginas por derechos de autor.", 3000, 1000);
            else if (command === '#contrabando') ejecutarCrimenRapido("Pasaste lazos de encaje rosa sin pagar aduana.", "Los caninos detectaron tus lujos mercantiles.", 8000, 3000);
            else if (command === '#estafa') ejecutarCrimenRapido("Le vendiste un curso falso a un ingenuo.", "Te funaron masivamente en redes.", 6000, 2000);
            else if (command === '#asalto') ejecutarCrimenRapido("Asaltaste una tienda usando una navaja oxidada.", "El cajero sacó un arma mayor y te correteó.", 9000, 4000);
            else if (command === '#hackear') ejecutarCrimenRapido("Vulneraste las cuentas de ahorros de un millonario.", "Rastrearon tu IP de Termux por descuidado.", 15000, 5000);

            else if (command === '#bal') reply(`*💳 EFECTIVO EN MANO:* ${groupSymbol}${user.wallet}\n» Usa \`#banco\` para ver tu balance resguardado.`);

            // ==========================================
            // JUEGOS DE AZAR
            // ==========================================
            else if (command === '#ruleta') {
                if (Math.random() > 0.5) { user.wallet += 5000; reply(`🎰 Cayó en tu color de la suerte. *+${groupSymbol}5000*`); }
                else { user.wallet = Math.max(0, user.wallet - 3000); reply(`🎰 La bola cayó en pérdida. *-${groupSymbol}3000*`); }
                saveDB();
            }
            else if (command === '#suerte') {
                if (Math.random() > 0.5) { user.wallet *= 2; reply(`🍀 ¡Duplicaste todo tu efectivo en mano!`); }
                else { user.wallet = 0; reply(`💀 Mala fortuna. Quedaste completamente en cero.`); }
                saveDB();
            }
            else if (command === '#dados') {
                let p1 = Math.floor(Math.random() * 6) + 1;
                let p2 = Math.floor(Math.random() * 6) + 1;
                if (p1 >= p2) { user.wallet += 3000; reply(`🎲 Sacaste ${p1} y el bot ${p2}. Ganaste *+${groupSymbol}3000*`); }
                else { user.wallet = Math.max(0, user.wallet - 2000); reply(`🎲 Sacaste ${p1} y el bot ${p2}. Perdiste *-${groupSymbol}2000*`); }
                saveDB();
            }
            else if (command === '#tragamonedas') {
                let ems = ["🎀", "💀", "👑"];
                let r1 = ems[Math.floor(Math.random() * 3)];
                let r2 = ems[Math.floor(Math.random() * 3)];
                let r3 = ems[Math.floor(Math.random() * 3)];
                if (r1 === r2 && r2 === r3) { user.wallet += 15000; reply(`🎰 [${r1}|${r2}|${r3}] ¡TRIPLE EN LÍNEA! *+${groupSymbol}15000*`); }
                else { user.wallet = Math.max(0, user.wallet - 1500); reply(`🎰 [${r1}|${r2}|${r3}] Sigue intentando.`); }
                saveDB();
            }
            else if (command === '#blackjack') {
                if (Math.random() > 0.48) { user.wallet += 6000; reply(`🃏 Sumaste 21 natural en mesa. *+${groupSymbol}6000*`); }
                else { user.wallet = Math.max(0, user.wallet - 4000); reply(`🃏 La casa gana.`); }
                saveDB();
            }

            // ==========================================
            // TIENDA GENERAL DE ITEMS Y CRÍAS
            // ==========================================
            else if (command === '#tienda') {
                let txt = `🛒 *TIENDA PREMIUM RPG* 🛒\nMoneda: ${groupSymbol}\n\n`;
                for (const [k, v] of Object.entries(SHOP)) txt += `🛍️ *#buy ${k}* -> ${groupSymbol}${v.cost}\n» ${v.desc}\n\n`;
                reply(txt);
            }
            else if (command === '#buy') {
                const item = text.trim().toLowerCase();
                if (!SHOP[item]) return reply('❌ El artículo no existe en el catálogo.');
                if (user.wallet < SHOP[item].cost) return reply('❌ No te alcanza el dinero.');
                user.wallet -= SHOP[item].cost; user.inventory[item] = (user.inventory[item] || 0) + 1; saveDB();
                reply(`🛍️ Adquiriste 1 *${item}* con éxito.`);
            }
            else if (command === '#opencofre') {
                let box = Object.keys(user.inventory).find(k => k.includes('cofre') && user.inventory[k] > 0);
                if (!box) return reply('❌ Compra cajas o huevos en la #tienda primero.');
                user.inventory[box] -= 1;
                const rolled = PET_POOL[Math.floor(Math.random() * PET_POOL.length)];
                user.pets.push({ name: rolled.name, rarity: rolled.rarity, lvl: 1, dmg: rolled.dmg });
                saveDB();
                reply(`📦 *ECLOSIÓN:* Obtuviste un *${rolled.name}* [${rolled.rarity}].`);
            }
            else if (command === '#petlist') {
                if (user.pets.length === 0) return reply('🥚 No tienes criaturas.');
                reply(`🐾 *MIS MASCOTAS:* \n\n${user.pets.map((p, i) => `${i + 1}. ${p.name} (Lvl: ${p.lvl})`).join('\n')}`);
            }

            // ==========================================
            // UTILIDADES Y SUBSIDIOS
            // ==========================================
            else if (command === '#mochila') {
                let txt = `🎒 *MOCHILA DE OBJETOS* 🎒\n\n`;
                for (const [k, v] of Object.entries(user.inventory)) { if (v > 0) txt += `📦 *${k}:* ${v} unidades\n`; }
                reply(txt.includes('unidades') ? txt : '🎒 Tu mochila está vacía.');
            }
            else if (command === '#diario') {
                let ahora = Date.now();
                if (ahora - user.lastDaily < 86400000) return reply('❌ Regresa mañana por tu bono.');
                user.wallet += 3000; user.lastDaily = ahora; saveDB();
                reply(`🎁 Apoyo diario cobrado: *+${groupSymbol}3000*`);
            }
            
            else if (command === '#monthly') {
                let ahora = Date.now();
                let unMesEnMs = 30 * 24 * 60 * 60 * 1000;
                
                if (ahora - user.lastMonthly < unMesEnMs) {
                    let tiempoRestante = unMesEnMs - (ahora - user.lastMonthly);
                    let dias = Math.floor(tiempoRestante / (24 * 60 * 60 * 1000));
                    let horas = Math.floor((tiempoRestante % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                    return reply(`❌ Ya reclamaste tu mega bono este mes. Te falta esperar: *${dias} días y ${horas} horas*.`);
                }
                
                const ganaVIP = Math.floor(Math.random() * 50000) + 50000;
                user.wallet += ganaVIP; user.lastMonthly = ahora; saveDB();
                
                const fraseMonthly = getRandomPhrase(OpcionesMensajes.monthly);
                reply(`👑 *SUBSIDIO MENSUAL VIP* 👑\n\n${fraseMonthly}\n*Recompensa Colosal: +${groupSymbol}${ganaVIP}*`);
            }
            
            else if (command === '#borrarcuenta') {
                delete db.users[sender]; saveDB(); reply('🗑️ Historial borrado.');
            }
            else if (command === '#pelicula') {
                let shuffled = [...MOVIE_POOL].sort(() => 0.5 - Math.random());
                let sel = shuffled.slice(0, 3);
                reply(`🍿 *CARTELERA RECOMENDADA*\n\n🎥 1. ${sel[0]}\n🎥 2. ${sel[1]}\n🎥 3. ${sel[2]}`);
            }

            // ==========================================
            // GESTIÓN ADMINISTRATIVA
            // ==========================================
            if (command === '#tag' && isGroup && (isUserAdmin || isOwner)) {
                let mems = participants.map(p => p.id);
                let txt = `📢 *INVOCACIÓN GENERAL:*\n\n${text || '¡Atención!'}\n\n`;
                for (let m of mems) txt += `@${m.split('@')[0]}\n`;
                await sock.sendMessage(from, { text: txt, mentions: mems });
            }
            else if (command === '#close' && isGroup && (isUserAdmin || isOwner) && isBotAdmin) {
                await sock.groupSettingUpdate(from, 'announcement'); reply('🔒 *Chat Cerrado.*');
            }
            else if (command === '#open' && isGroup && (isUserAdmin || isOwner) && isBotAdmin) {
                await sock.groupSettingUpdate(from, 'not_announcement'); reply('🔓 *Chat Abierto.*');
            }
            else if (command === '#kick' && isGroup && (isUserAdmin || isOwner) && isBotAdmin) {
                let target = getTarget(); if (!target) return reply('❌ Indica a quién expulsar.');
                await sock.groupParticipantsUpdate(from, [target], 'remove'); reply('❌ Removido.');
            }

        } catch (e) { console.error(e); }
    });
}

startBot();

# Bot-De-whatsapp
Bot de whatsapp de economía y interacciones con un tono un tanto soez y vulgar, recuerda que este bot fue creado principalmente para abrirse o ejecutarse en termux más isn embargo también funciona de maravilla en servers, el código base esta en el Index.js y recuerda configurar así termux antes de ejecutar el bot 
# 1. Asegurarnos de estar en la carpeta correcta del bot
mkdir -p ~/wabot-rpg && cd ~/wabot-rpg

# 2. Instalar solo las dependencias oficiales, limpias y estables
npm init -y
npm install @whiskeysockets/baileys pino @hapi/boom

# 3. Limpiar cualquier rastro de index.js anterior y abrir el editor
> index.js
nano index.js
# 4. Pegar el Index.js y ejecutarlo con node.js

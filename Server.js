const CONNECTIONPROTOCOLS = {
    OPEN: 0,
    CLOSE: 1,
    LOGIN: 2,
    MSG: 3,
    ANNOUNCEMENT: 4,
    KICK: 5
}
const ACTIONPROTOCOLS = {
    MOVELEFT: 6,
    MOVERIGHT: 7,
    JUMP: 8,
    SHOOT: 9,
    SLIDE: 10,
    DIE: 11,
    GETHIT: 12,
    SPAWN: 13,
    NEWPLAYER: 14,
    PLAYERLEFT: 15,
    POSITIONUPDATE: 16
}
const GAMEPROTOCOLS = {
    GAMESTATE: 17,
    GAMEEND: 18,
    GAMESTART: 19,
    GAMEFIRSTTIMEENTER: 20
}
const DEATHPROTOCOLS = {
    FELLDOWN: -1
}
const ADMINPROTOCOLS = {
    SENDANNOUNCEMENT: 1100,
    KICKPLAYER: 1101,
    CHANGEPLAYER: 1102,
    CHANGEBULLETDAMAGE: 1103,
    DELETEALLWALLS: 1104,
    DELETEWALL: 1105,
    ADDWALL: 1106,
    GETALLPLAYERS: 1107
}

class Entity {
    constructor(id, x, y, rot, vspd, hspd, isPlayer, isNPC) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.rot = rot;
        this.vspd = vspd;
        this.hspd = hspd;
        this.isPlayer = isPlayer;
        this.isNPC = isNPC;
    }

    move() {}
    destroy() {}
}

class Player{
    constructor(conn, ip, id = -1, name = "", posx = 0, posy = 0, spd = 6, health = 100, respawnTimer = 3000, maxHealth = 100, isingame = false) {
        this.conn = conn;
        this.ip = ip;
        this.id = id;
        this.name = name;
        this.admin = false;
        this.posx = posx;
        this.posy = posy;
        this.spd = spd;
        this.angle = 0;
        this.health = health;
        this.maxHealth = maxHealth;
        this.isingame = isingame;
        this.respawnTimer = respawnTimer;
        this.isDead = false;
        this.kills = 0;
        this.deaths = 0;
        this.stats = null;

        // Arrow Mechanics
        this.arrows = Math.floor(75 + Math.random() * 33);
        this.maxArrows = 256;
        this.freeArrowsInterval = 875;
        this.freeArrowsCount = 1;

        // To prevent Macros
        this.amountOfBullets = 0;
        this.amountOfBulletsThreshold = 10;
        this.bulletCounterEndTime = Date.now();
        this.bulletCounterInterval = 1000;

        players.push(this);
    }

    FindStatsObject() {
        for(let i = 0; i < allPlayerStats.length; i++) {
            if (allPlayerStats[i].ip == this.ip) { // If our ip is in stats
                this.stats = allPlayerStats[i];
                this.kills = this.stats.kills;
                this.deaths = this.stats.deaths;
                
                for (let j = 0; j < this.stats.names.length; j++) // If our name is in the stats we shouldnt add it again.
                    if (this.stats.names[j] == this.name) return;

                this.stats.names.push(this.name);
                return;
            }
        }

        this.stats = new Stats(this.ip, this.kills, this.deaths, [this.name]);
    }

    GetFreeArrow() {
        setInterval(() => {
            if (this.isingame && !this.isDead && this.arrows < 80)
                this.arrows += this.freeArrowsCount;
        }, this.freeArrowsInterval);
    }

    GetDetailedInfo() {
        return this.id + ":" + this.ip + ":" + this.name + ":" + this.posx + ":" + this.posy + ":" + 
        this.spd + ":" + this.health + ":" + this.maxHealth + ":" + this.kills + ":" + this.deaths + ":" + this.isDead + ":" + this.arrows;
    }

    KilledSomeone(thenoobwhodied) {
        this.stats.kills++;
        this.kills++;
        this.maxHealth += 1;
        this.health += Math.floor(12 + Math.random() * 32);
        this.arrows += Math.floor(12 + Math.random() * 16);

        if (this.arrows > this.maxArrows)
            this.arrows = this.maxArrows;
        if (this.health > this.maxHealth)
            this.health = this.maxHealth;
        if (this.maxHealth > 150)
            this.maxHealth = 150;
    }

    SendGameState(gs) {
        if (this.isingame)
            this.conn.send(gs);
    }

    Die(deathByID) {
        if (this.isDead) return;

        this.maxHealth -= 6;
        if (this.maxHealth < 100) this.maxHealth = 100;

        this.stats.deaths++;
        this.deaths++;
        this.isDead = true;
        for (let i = 0; i < players.length; i++)
            players[i].SendGameState(ACTIONPROTOCOLS.DIE + ":" + this.id + ":" + deathByID);
        
        setTimeout(() => { this.Respawn(Math.floor(Math.random() * (gameWidth - 64)), 0); }, this.respawnTimer);

        let killer;
        for (let i = 0; i < players.length; i++)
            if (players[i].id == deathByID) {
                players[i].KilledSomeone(this);
            }
    }

    Respawn(x, y) {
        if (!this.isDead) return;

        this.isDead = false;
        this.posx = x;
        this.posy = y;
        this.health = this.maxHealth;
        this.arrows = Math.floor(75 + Math.random() * 33);

        for (let i = 0; i < players.length; i++)
            players[i].SendGameState(ACTIONPROTOCOLS.SPAWN + ":" + this.id + ":" + this.posx + ":" + this.posy);
    }

    GetHit(projectileOwnerID) {
        this.health -= bulletDamage;

        if (this.health < 1)
            this.Die(projectileOwnerID);
        else
            for (let i = 0; i < players.length; i++)
                players[i].SendGameState(ACTIONPROTOCOLS.GETHIT + ":" + this.id + ":" + bulletDamage);
    }

    MoveLeft() {
        this.posx -= this.spd;
        for (let i = 0; i < players.length; i++)
            if (players[i].id != this.id)
                players[i].SendGameState(ACTIONPROTOCOLS.MOVELEFT + ":" + this.id);
    }

    MoveRight() {
        this.posx += this.spd;
        for (let i = 0; i < players.length; i++)
            if (players[i].id != this.id)
                players[i].SendGameState(ACTIONPROTOCOLS.MOVERIGHT + ":" + this.id);
    }

    Jump() {
        for (let i = 0; i < players.length; i++)
            if (players[i].id != this.id)
                players[i].SendGameState(ACTIONPROTOCOLS.JUMP + ":" + this.id);
    }

    Shoot(posx, posy, angle) {
        if (this.arrows < 1) return;  

        if (this.amountOfBullets > this.amountOfBulletsThreshold) {
            KickPlayer(this.id, 0, "Disable Macro!");
            return;
        }

        if (Date.now() > this.bulletCounterEndTime)
            this.bulletCounterEndTime = Date.now() + this.bulletCounterInterval,
            this.amountOfBullets = 0;
        
        this.amountOfBullets++;
        this.arrows--;
        for (let i = 0; i < players.length; i++)
            players[i].SendGameState(ACTIONPROTOCOLS.SHOOT + ":" + this.id + ":" + posx + ":" + posy + ":" + angle);
    }

    Slide() {
        for (let i = 0; i < players.length; i++)
            if (players[i].id != this.id)
                players[i].SendGameState(ACTIONPROTOCOLS.SLIDE + ":" + this.id);
    }

    UpdatePosition(x, y, angle) {
        this.posx = x;
        this.posy = y;
        this.angle = angle;
    }
}

class Wall{
    constructor(x, y, w, h, moveable = false, vspd = 0, hspd = 0) {
        this.id = wallID++;
        this.x = x + w/2;
        this.y = y + h/2;
        this.w = w;
        this.h = h;
        this.moveable = moveable;
        this.vspd = vspd;
        this.hspd = hspd;
        this.gsInitText = this.id + ":" + this.x + ":" + this.y + ":" + this.w + ":" + this.h + (this.moveable ? ":" + this.vspd + ":" + this.hspd: "");
        this.gsPriText = this.moveable ? this.id + ":" + this.x + ":" + this.y + ":" + this.vspd + ":" + this.hspd: "";

        walls.push(this);
        
        if (this.moveable)
            setInterval(() => { this.move(); }, 16);
    }

    move() {
        this.x += this.hspd;
        this.y += this.vspd;

        if (this.x + this.w/2 < 0) this.hspd = -this.hspd;
        else if (this.x - this.w/2 > gameWidth) this.hspd = -this.hspd;
        if (this.y + this.h/2 < 0) this.vspd = -this.vspd;
        else if (this.y - this.h/2 > gameHeight) this.vspd = -this.vspd;

        this.gsInitText = this.id + ":" + this.x + ":" + this.y + ":" + this.w + ":" + this.h + ":" + this.vspd + ":" + this.hspd;
        this.gsPriText = this.id + ":" + this.x + ":" + this.y + ":" + this.vspd + ":" + this.hspd;
    }
}

class Stats {
    constructor(ip, kills, deaths, names) {
        this.ip = ip;
        this.kills = kills;
        this.deaths = deaths;
        this.names = names;

        allPlayerStats.push(this);
    }
}



// ----------------------------------------------------------
// ----------------------- Logs -----------------------------
// ----------------------------------------------------------
var fs = require('fs');
// Chat Logs
var chatLogPath = "Logs/ChatLogs.txt";
var chatLogStream = fs.createWriteStream(chatLogPath, {flags: 'a'});
// Event Logs
var logPath = "Logs/IPLogs.txt";
var logStream = fs.createWriteStream(logPath, {flags: 'a'});
// IP-Ban Logs
var bannedIPs = [];
var bannedIPPath = "Logs/IPBans.txt";
fs.readFile(bannedIPPath, "utf8", (err, data) => {
    if (err) return console.log(err);
    if (data.length < 3) return;

    var ipsSplit = data.split("\n");
    for (let i = 0; i < ipsSplit.length; i++)
        bannedIPs.push(ipsSplit[i]);
});
var bannedIPStream = fs.createWriteStream(bannedIPPath, {flags: 'a'});
// Stats
var statsPath = "Logs/Stats.txt";

var allPlayerStats = [];
fs.readFile(statsPath, "utf8", (err, data) => {
    if (err) return console.log(err);
    if (data.length < 3) return;

    var statsSplit = data.split("\n");
    for (let i = 0; i < statsSplit.length; i++)
        ReadStatData(statsSplit[i]);
});
function ReadStatData(data) {
    if (data.length < 3) return;
    var dataSplit = data.split(":");
    new Stats(dataSplit[0], parseInt(dataSplit[1]), parseInt(dataSplit[2]), dataSplit[3].split("&"));
}
function WriteAllStatData() {
    let allNames = "";
    let data = "";
    for (let j = 0; j < allPlayerStats.length; j++) {
        allNames = "";
        for (let i = 0; i < allPlayerStats[j].names.length; i++) 
            allNames += allPlayerStats[j].names[i] + "&";
        
        data += allPlayerStats[j].ip + ":" + allPlayerStats[j].kills + ":" + allPlayerStats[j].deaths + ":" + allNames.substring(0, allNames.length - 1) + "\n";
    }
    
    fs.writeFile(statsPath, data, function(err){if (err) console.log(err);});
}

setInterval(WriteAllStatData, 3000);




// ----------------------------------------------------------
// ---------------------- Server ----------------------------
// ----------------------------------------------------------
const WebSocket = require('ws');
const ws = new WebSocket.Server({ host: "192.168.1.100", port: 14785 });
console.log("Server is Started!");
logStream.write("Server Started at " + new Date().toLocaleString() + "\n");

var players = [];
var walls = [];
var id = 0;
var wallID = 1000;
var gameWidth = 3120;
var gameHeight = 1080;

var bulletDamage = 14;
var adminPassword = "themostsecurepasswordever";

new Wall(236.93691345151203, 664.6424759871933, 42.99009384775809, 360.81003201707574, true, -0.5, 0);
new Wall(0, 542.7075773745999, 156.96037539103233, 37.98505869797225, false, 0, 0);
new Wall(669.825338894682, 918.5069370330843, 32.99270072992704, 108.9445037353255, false, 0, 0);
new Wall(1962.4869655891555, 247.86766275346855, 973.7486965589158, 40.98078975453575, false, 0, 0);
new Wall(2789.27267987487, 308.8324439701174, 39.98957247132421, 714.62113127001, true, -4, 0);
new Wall(2241.415537017727, 945.495197438634, 203.9468196037542, 81.95624332977582, false, 0, 0);
new Wall(2157.4374348279457, 725.6125933831378, 37.99009384775809, 161.91355389541081, false, 0, 0);
new Wall(1985.4822732012515, 715.6179295624333, 211.9447340980189, 55.9701173959445, false, 0, 0);
new Wall(1843.51929092805, 531.7161152614729, 41.989051094890556, 239.871931696905, false, 0, 0);
new Wall(1691.5589155370178, 531.7161152614729, 195.94890510948903, 43.97652081109925, false, 0, 0);
new Wall(437.8858185610011, 152.91568836712915, 49.986965589155375, 83.96051227321237, false, 0, 0);
new Wall(361.905630865485, 239.871931696905, 467.87799791449436, 60.970117395944555, false, 0, 0);
new Wall(681.8222106360793, 208.88580576307365, 47.98748696558914, 28.987193169690528, false, 0, 0);
new Wall(554.8540145985401, 410.778014941302, 61.98644421272161, 220.88473852721444, false, 0, 0);
new Wall(1362.643378519291, 8.992529348986126, 316.91866527632965, 35.98612593383138, true, 2, 0);
new Wall(380.8993743482795, 495.7353255069371, 172.9562043795621, 49.97331910352182, false, 0, 0);
new Wall(1.999478623566215, 279.85058697972255, 145.96193952033371, 25.986125933831374, false, 0, 0);
new Wall(234.9374348279458, 1028.4482390608325, 2799.27267987487, 42.97972251867668, false, 0, 0);
new Wall(1009.7367049009385, 985.4738527214515, 311.91866527632965, 27.98505869797225, true, -2, 0);
new Wall(1.9994786235662332, 390.7886872998933, 265.93065693430657, 24.98932764140875, true, 0, 5);
new Wall(2059.4629822732013, 289.8452508004269, 27.992700729927037, 157.91568836712912, false, 0, 0);
new Wall(1997.4791449426486, 401.7854855923159, 89.9765380604797, 47.974386339381, false, 0, 0);
new Wall(2931.2356621480712, 181.90288153681968, 135.9645464025025, 105.9434364994664, false, 0, 0);
new Wall(2999.2179353493225, 107.94236926360726, 69.98175182481737, 73.96051227321239, false, 0, 0);

ws.on('connection', function connection(conn, req) {
    console.log("New Connection: " + req.connection.remoteAddress + " ---- " + (players.length + 1));

    // Check if banned
    for (let i = 0; i < bannedIPs.length; i++) {
        if (bannedIPs[i] == req.connection.remoteAddress) {
            conn.send(CONNECTIONPROTOCOLS.KICK + ":1:BANNED.");
            conn.close();
            return;
        }
    }

    conn.send(CONNECTIONPROTOCOLS.OPEN);
    
    let newPlayer = new Player(conn, req.connection.remoteAddress, id++);

    newPlayer.conn.on('message', function incoming(message) {
        var msg = message.split(":");
        if (msg[0] == CONNECTIONPROTOCOLS.LOGIN) {
            if (newPlayer.isingame) return;

            // Admin Panel Log-in
            if (msg.length == 3) {
                if (msg[1] == "adminpanel" && msg[2] == adminPassword) {
                    logStream.write("[" + new Date().toLocaleString() + "] " + "A new admin connected! --> [" + newPlayer.ip + "]");
                    newPlayer.admin = true;
                    conn.send(CONNECTIONPROTOCOLS.LOGIN);
                    return;
                }
                else {
                    conn.send(CONNECTIONPROTOCOLS.CLOSE);
                    return;
                }
            }

            // Welcome the guy who joined
            conn.send(CONNECTIONPROTOCOLS.LOGIN + ":" + newPlayer.id + ":" + gameWidth + ":" + gameHeight);
            newPlayer.name = msg[1];
            newPlayer.posx = Math.floor(30 + (Math.random() * gameWidth - 60));
            newPlayer.posy = 30 - Math.random() * 60;
            newPlayer.isingame = true;
            newPlayer.FindStatsObject();
            newPlayer.GetFreeArrow();
            
            // Log
            logStream.write("[" + new Date().toLocaleString() + "] New Player: [" + newPlayer.ip + "] " + newPlayer.name + "\n");
            // Send Game Data now
            let newPlayersData = GetGameState(newPlayer.id);
            newPlayer.SendGameState(GetGameState(null, true));

            for (let i = 0; i < players.length; i++)
                if (players[i].isingame && newPlayer.id != players[i].id)
                    players[i].SendGameState(newPlayersData);
            
            newPlayer.conn.send(CONNECTIONPROTOCOLS.MSG + ":[SERVER]: Archerus'a Hoş Geldin!");
            newPlayer.conn.send(CONNECTIONPROTOCOLS.MSG + ":[SERVER]: Oyunu W-A-S-D ve Mousela oynayabilirsiniz.");
        }
        else if (msg[0] == ACTIONPROTOCOLS.MOVELEFT)
            newPlayer.MoveLeft();
        else if (msg[0] == ACTIONPROTOCOLS.MOVERIGHT)
            newPlayer.MoveRight();
        else if (msg[0] == ACTIONPROTOCOLS.JUMP)
            newPlayer.Jump();
        else if (msg[0] == ACTIONPROTOCOLS.SHOOT)
            newPlayer.Shoot(parseFloat(msg[1]), parseFloat(msg[2]), parseFloat(msg[3]));
        else if (msg[0] == ACTIONPROTOCOLS.SLIDE)
            newPlayer.Slide();
        else if (msg[0] == ACTIONPROTOCOLS.GETHIT)
            newPlayer.GetHit(msg[1]);
        else if (msg[0] == ACTIONPROTOCOLS.DIE)
            newPlayer.Die(msg[1]);
        else if (msg[0] == ACTIONPROTOCOLS.POSITIONUPDATE)
            newPlayer.UpdatePosition(parseFloat(msg[1]), parseFloat(msg[2]), parseFloat(msg[3]));
        else if (msg[0] == CONNECTIONPROTOCOLS.MSG)
            PlayerMessage(msg[1], msg[2], newPlayer.ip);
        else if (msg[0] == ADMINPROTOCOLS.SENDANNOUNCEMENT) {
            if (newPlayer.admin && msg.length == 7)
                SendAnnouncement(msg[1], parseInt(msg[2]), parseInt(msg[3]), parseInt(msg[4]), parseInt(msg[5]), parseInt(msg[6]));
        }
        else if (msg[0] == ADMINPROTOCOLS.CHANGEBULLETDAMAGE) {
            if (newPlayer.admin && msg.length == 2)
                ChangeBulletDamage(parseInt(msg[1]));
        }
        else if (msg[0] == ADMINPROTOCOLS.KICKPLAYER) {
            if (newPlayer.admin && msg.length == 4)
                KickPlayer(parseInt(msg[1]), parseInt(msg[2]), msg[3]);
        }
        else if (msg[0] == ADMINPROTOCOLS.CHANGEPLAYER) {
            if (newPlayer.admin && msg.length == 8)
                ChangePlayer(parseInt(msg[1]), msg[2], parseFloat(msg[3]), parseInt(msg[4]), parseInt(msg[5]), parseInt(msg[6]), parseInt(msg[7]));
        }
        else if (msg[0] == ADMINPROTOCOLS.DELETEALLWALLS) {
            if (newPlayer.admin)
                DeleteAllWalls();
        }
        else if (msg[0] == ADMINPROTOCOLS.DELETEWALL) {
            if (newPlayer.admin && msg.length == 2)
                DeleteWall(parseInt(msg[1]));
        }
        else if (msg[0] == ADMINPROTOCOLS.ADDWALL) {
            if (newPlayer.admin && msg.length == 8)
                AddWall(parseInt(msg[1]), parseInt(msg[2]), parseInt(msg[3]), parseInt(msg[4]), parseInt(msg[5]), parseFloat(msg[6]), parseFloat(msg[7]));
        }
        else if (msg[0] == ADMINPROTOCOLS.GETALLPLAYERS) {
            if (newPlayer.admin)
                newPlayer.conn.send(GetAllPlayers());
        }
    });

    newPlayer.conn.on('close', function() {
          for (let i = 0; i < players.length; i++) {
              if (players[i].id == newPlayer.id) {
                  let hewasingame = players[i].isingame;
                  players.splice(i, 1);

                  if (hewasingame) // we should broadcast that the player left.
                    for (let j = 0; j < players.length; j++)
                        players[j].SendGameState(ACTIONPROTOCOLS.PLAYERLEFT + ":" + newPlayer.id);

                  return;
              }
          }
    })
});

function GetGameState(includeOnlyPlayerID = null, firstTimeEnteringWorld = false) {
    let gs = (includeOnlyPlayerID != null ? ACTIONPROTOCOLS.NEWPLAYER: GAMEPROTOCOLS.GAMESTATE) + ":";
    if (firstTimeEnteringWorld) gs = GAMEPROTOCOLS.GAMEFIRSTTIMEENTER + ":";

    // PLAYERS
    if (includeOnlyPlayerID) {
        for (let i = 0; i < players.length; i++) {
            if (players[i].isingame && players[i].id == includeOnlyPlayerID) {
                gs += players[i].id + ":" + players[i].name + ":" + players[i].posx + ":" + players[i].posy + ":" + players[i].health + ":" + players[i].maxHealth + ":" + players[i].kills + ":" + players[i].deaths + ":" + players[i].spd + ":" + players[i].arrows + ":" + players[i].angle + "!";
                break;
            }
        }
    }
    else
        for (let i = 0; i < players.length; i++)
            if (players[i].isingame)
                gs += players[i].id + ":" + players[i].name + ":" + players[i].posx + ":" + players[i].posy + ":" + players[i].health + ":" + players[i].maxHealth + ":" + players[i].kills + ":" + players[i].deaths + ":" + players[i].spd + ":" + players[i].arrows + ":" + players[i].angle + "!";

    
    if (gs.substr(-1, 1) == "!")
        gs = gs.substring(0, gs.length - 1);

    gs += "&"; // Seperator for Players and Walls, different types.
    // WALLS
    if (firstTimeEnteringWorld)
        for (let i = 0; i < walls.length; i++)
            gs += walls[i].gsInitText + "!";

    else           
        for (let i = 0; i < walls.length; i++)
            if (walls[i].moveable) // If the wall doesn't move, we dont send it.
                gs += walls[i].gsPriText + "!";

    return gs.substr(0, gs.length - 1);
}

function BroadcastGameState() {
    if (players.length == 0) return;
    let gs = GetGameState();

    for (let i = 0; i < players.length; i++)
        if (players[i].isingame && id != players[i].id)
            players[i].SendGameState(gs);       
}

setInterval(BroadcastGameState, 167);

function SendMessageToAllPlayers(msg) {
    for (let i = 0; i < players.length; i++)
        if (players[i].isingame)
            players[i].conn.send(CONNECTIONPROTOCOLS.MSG + ":" + "[SERVER]" + ":" + msg);
}

function PlayerMessage(name, msg, ip = "SERVER") {
    chatLogStream.write("[" + new Date().toLocaleString() + "] [" + ip + "] " + name + ": " + msg + "\n");

    if (msg.length > 64) msg = msg.substring(0, 64);
    if (name.length > 32) name = name.substring(0, 32);

    for (let i = 0; i < players.length; i++)
        if (players[i].isingame)
            players[i].conn.send(CONNECTIONPROTOCOLS.MSG + ":" + name + ":" + msg);
}

// ADMIN PANEL FUNCTIONS
function GetAllPlayers() {
    let data = ADMINPROTOCOLS.GETALLPLAYERS + ":";
    for (let i = 0; i < players.length; i++)
        if (players[i].isingame)
            data += players[i].GetDetailedInfo() + "!";
    
    if (data.substr(-1, 1) == "!" || data.substr(-1, 1) == ":") 
        return data.substring(0, data.length - 1);
    return data;
}

function SendAnnouncement(msg, interval, size, c1, c2, c3) {
    chatLogStream.write("[" + new Date().toLocaleString() + "] An announcement made! -> '" + msg + "' props: " + interval + ", " + size + "\n");
    let protocolMsg = CONNECTIONPROTOCOLS.ANNOUNCEMENT + ":" + msg + ":" + interval + ":" + size + ":" + c1 + ":" + c2 + ":" + c3;
    for (let i = 0; i < players.length; i++)
        if (players[i].isingame)
            players[i].SendGameState(protocolMsg);
}

function ChangeBulletDamage(dmg) {
    bulletDamage = dmg;
}

function KickPlayer(id, ban, reason) {
    for (let i = 0; i < players.length; i++) {
        if (players[i].id == id) {
            if (ban == 1) {
                logStream.write("[" + new Date().toLocaleString() + "] A player is banned. [" + players[i].ip + "] " + players[i].name + " --- reason: " + reason + "\n");
                bannedIPStream.write(players[i].ip + "\n");
                bannedIPs.push(players[i].ip);
            }

            players[i].SendGameState(CONNECTIONPROTOCOLS.KICK + ":" + ban + ":" + reason);
            players[i].conn.close();
            players.splice(i, 1);
            break;
        }
    }

    for (let i = 0; i < players.length; i++)
        players[i].SendGameState(ACTIONPROTOCOLS.PLAYERLEFT + ":" + id + ":" + ban + ":" + reason);
}

function ChangePlayer(id, name, spd, health, maxHealth, kills, deaths) {
    for (let i = 0; i < players.length; i++) {
        if (players[i].isingame && players[i].id == id) {
            players[i].name = name;
            players[i].spd = spd;
            players[i].health = health;
            players[i].maxHealth = maxHealth;
            players[i].kills = kills;
            players[i].deaths = deaths;
        }
    }
}

function DeleteAllWalls() {
    walls = [];
}

function DeleteWall(id) {
    for (let i = 0; i < walls.length; i++) {
        if (walls[i].id == id) {
            walls.splice(i, 1);
            return;
        }
    }
}

function AddWall(x, y, w, h, moveable = false, vspd = 0, hspd = 0) {
    new Wall(x, y, w, h, moveable == 1 ? true : false, vspd, hspd);
}
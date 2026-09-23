/// <reference types="vite/client" />
import * as Phaser from 'phaser';
import { HEROES, StreetGame, type Fighter } from './simulation';
import { KNOCKBACK } from './combat-data';
import { BOSS_RULES, CHARGES } from './encounter-data';

export function createStreetGame(parent: HTMLElement, sim: StreetGame, publish: () => void, sound: (name: string) => void) {
  class StreetScene extends Phaser.Scene {
    ink!: Phaser.GameObjects.Graphics;
    labels: Phaser.GameObjects.Text[] = [];
    lastPublish = 0;
    constructor() { super('south-bridge'); }
    create() {
      this.ink = this.add.graphics(); this.game.canvas.setAttribute('aria-label', '南桥街横版格斗场地');
      if (import.meta.env.DEV) {
        const debug = window as unknown as { __STREET_READ__?: () => unknown };
        debug.__STREET_READ__ = () => ({ phase:sim.phase, chapter:sim.chapter, wave:sim.wave, training:sim.training, paused:sim.paused, hero:{...sim.hero}, enemies:sim.enemies.map(e=>({...e})), crates:sim.crates.map(c=>({...c})), carried:sim.carried?{...sim.carried}:null, shots:sim.shots.map(s=>({...s})), kills:sim.kills, rage:sim.rage });
        this.events.once('shutdown',()=>{delete debug.__STREET_READ__;});
      }
    }
    update(t: number, delta: number) {
      sim.update(delta / 1000); sim.events.splice(0).forEach(sound);
      this.draw(); if (t - this.lastPublish > 80) { publish(); this.lastPublish = t; }
    }
    label(x: number, y: number, value: string, size = 10, color = '#e8c79a') {
      const text = this.add.text(Math.round(x), Math.round(y), value, { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: `${size}px`, color, fontStyle: 'bold', stroke: '#172030', strokeThickness: 2 }); this.labels.push(text); return text;
    }
    draw() {
      this.labels.forEach(t => t.destroy()); this.labels = []; const g = this.ink; g.clear();
      const r = (x: number, y: number, w: number, h: number, c: number, a = 1) => { g.fillStyle(c, a); g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
      const offset = sim.shake > 0 ? Math.sin(sim.time * 137) * sim.shake * 11 : 0;
      const width = this.scale.gameSize.width;
      // Expand the scenery, not the fighters or the combat bounds, on wide phones.
      const camera = (sim.phase === 'select' ? 0 : sim.camera) - (width - 480) / 2;
      r(0, 0, width, 270, 0x172331); r(0, 34, width, 70, 0x24384a);
      r(377 - camera * .07, 26, 22, 22, 0xebc68c); r(373 - camera * .07, 22, 19, 20, 0x172331);
      for (let i = -1; i < Math.ceil(width / 47) + 1; i++) {
        const x = i * 47 - camera * .17 % 47; const h = 37 + (i * 17 % 44);
        r(x, 111 - h, 39, h, 0x1b2b3e); for (let j = 0; j < 3; j++) r(x + 8 + j * 10, 120 - h, 3, 5, 0x9a865d, .55);
      }
      r(0, 150, width, 120, 0x343946); r(0, 154, width, 5, 0x7a6460); r(0, 160, width, 3, 0x242a35);
      for (let i = 0; i < 36; i++) { const x = i * 45 - camera % 45; r(x, 196, 25, 1, 0x52515b); r(x + 15, 235, 29, 1, 0x52515b); }
      r(0, 255, width, 15, 0x242733); for (let i = -1; i < Math.ceil(width / 50) + 1; i++) r(i * 50 - camera % 50, 257, 29, 2, 0x7b6753);
      const theme = sim.chapterData.theme;
      const signs = ['满记饭馆', '南桥修车', '街机游戏厅', '桥下拳馆', '黑桥赛事'];
      for (let i = -6; theme === 'market' && i < 16; i++) {
        const x = i * 182 - camera + offset; if (x < -190 || x > width) continue;
        const color = [0x675057, 0x45515a, 0x4f5552][((i % 3) + 3) % 3]; r(x, 51, 178, 103, color); r(x, 50, 178, 5, 0x9b7a68);
        for (let k = 0; k < 5; k++) { r(x, 75 + k * 16, 178, 1, 0x242c39, .3); r(x + k * 35, 51, 1, 103, 0x242c39, .2); }
        r(x + 10, 66, 154, 30, 0x252b38); r(x + 12, 68, 150, 2, i % 2 ? 0x71c6b2 : 0xeaa86c);
        this.label(x + 35, 73, signs[((i % 5) + 5) % 5], 15, i % 2 ? '#8adcc5' : '#ffd18d');
        r(x + 17, 104, 58, 46, 0x222b36); r(x + 21, 108, 50, 38, 0x897260); r(x + 43, 106, 3, 44, 0x302e35);
        r(x + 90, 101, 65, 49, 0x283440); for (let z = 0; z < 8; z++) r(x + 92, 104 + z * 6, 61, 2, 0x586268);
        if (i % 2 === 0) { for (let j = 0; j < 8; j++) r(x + 4 + j * 21, 98, 21, 8, j % 2 ? 0xb36b58 : 0xd5bc8b); }
        r(x + 170, 48, 3, 109, 0x252d38); r(x + 157, 47, 27, 4, 0x28313e);
        r(x + 169, 52, 14, 18, 0xb9544b); r(x + 174, 52, 4, 18, 0xf0a461); r(x + 175, 70, 2, 6, 0xe2a364);
      }
      if (theme === 'yard') {
        r(0,78,width,70,0x233f4a);
        for(let i=0;i<Math.ceil(width/41)+2;i++) r(((i*41+sim.time*5-camera*.2)%(width+40)+width+40)%(width+40)-20,102+i%4*9,20,1,0x567a79,.6);
        for(let i=-6;i<16;i++) {
          const x=i*242-camera*.65; r(x,38,6,99,0x344853);r(x,38,112,6,0x617679);r(x+92,44,2,47,0x758483);r(x+84,91,18,8,0xbc945c);
          r(x+8,110,111,25,0x192c39);r(x+30,99,28,11,0x354b55);
        }
        for(let i=-6;i<16;i++) {
          const x=i*218-camera; const color=i%2?0x596560:0x565563;
          r(x,82,153,71,color);r(x,81,153,5,0x96a28c);
          for(let k=0;k<13;k++)r(x+6+k*11,88,2,62,0x263c44,.5);
          r(x+44,101,72,22,0x293e49);this.label(x+54,106,['河岸货运','黑桥训练','装卸二区'][((i%3)+3)%3],11,'#d8c38e');
          r(x+165,88,4,65,0x82908b);r(x+157,85,20,5,0xffd492);r(x+149,90,36,57,0xffd492,.06);
        }
        r(0,150,width,5,0xd0b179);
        for(let i=0;i<35;i++)r(i*23-camera%23,150,12,5,0x303b43);
      }
      if (theme === 'mall') {
        // Shuttered arcade block: the same street the four of them grew up on, closed for the night.
        r(0,40,width,112,0x231f2c);
        for(let i=-6;i<16;i++){
          const x=i*198-camera*.55; r(x,34,7,104,0x2f2a38); r(x,34,120,6,0x4a4152); r(x+96,40,3,52,0x3d3547);
        }
        const fronts=['街机游戏厅','南桥百货','卷帘已锁'];
        for(let i=-6;i<16;i++){
          const x=i*196-camera; if(x<-200||x>width) continue;
          r(x,56,190,96,i%2?0x3b3542:0x342f3d); r(x,54,190,5,0x6b5a63);
          for(let k=0;k<16;k++) r(x+6,66+k*5,178,2,0x2a2531,.65);
          r(x+16,70,92,24,0x1b1822); r(x+18,72,88,2,i%2?0xe2739a:0xf0b678);
          this.label(x+24,75,fronts[((i%3)+3)%3],12,i%2?'#e78bab':'#f5c184');
          r(x+124,66,52,64,0x221e2a); r(x+128,70,44,56,0x39304a,.9);
          if(i%2===0){ r(x+132,78,36,4,0x6f5f86); r(x+132,90,36,4,0x6f5f86); }
          r(x+186,54,4,98,0x4b4250);
          r(x+150,50,6,8,0xffd08a,.5);
        }
        // Skywalk railing runs along the back of the lane instead of adding a second floor.
        r(0,138,width,3,0x59506a);
        for(let i=0;i<Math.ceil(width/19)+2;i++) r(i*19-camera%19,140,2,11,0x4a4255);
        r(0,150,width,4,0x6d6380);
      }
      if (theme === 'arena') {
        // Indoor venue: crowd, hanging lights and the ring behind the walking lane.
        r(0,18,width,134,0x171320);
        for(let i=-2;i<Math.ceil(width/158)+2;i++){
          const x=i*158-camera*.45; r(x+6,18,46,9,0x2b2436); r(x+14,27,30,6,0xffe3a4,.9);
          g.fillStyle(0xffe3a4,.05); g.fillTriangle(x+14,33,x+44,33,x+66,110); g.fillTriangle(x+14,33,x-8,110,x+44,33);
        }
        for(let i=0;i<Math.ceil(width/13)+3;i++){
          const x=i*13-camera*.3%13, h=22+(i*11%10);
          r(x,120-h,10,h,0x110e18); r(x+2,118-h,6,5,0x1b1725);
        }
        for(let i=-4;i<12;i++){ const x=i*268-camera*.8; r(x,44,96,30,0x3a1f2a); r(x+2,46,92,3,0xc4566a); this.label(x+12,52,'黑桥拳馆',12,'#efa2ae'); }
        for(let k=0;k<3;k++) r(0,122+k*9,width,2,k===1?0xd9c27a:0xc4566a,.75);
        for(let i=-2;i<Math.ceil(width/236)+2;i++){ const x=i*236-camera; r(x,112,6,42,0x51455c); r(x-2,110,10,5,0xd9c27a); }
        r(0,150,width,5,0x8d7f6b);
        for(let i=0;i<40;i++) r(i*27-camera%27,151,14,3,0x4a4250);
      }
      // Foreground street props remain outside the combat lane.
      for (let i = 0; i < 7; i++) { const x = i * 215 + 136 - camera; r(x, 142, 25, 14, 0x92704d); r(x + 2, 143, 21, 2, 0xc09c65); r(x + 11, 142, 2, 14, 0x5e4c40); }
      if (sim.food) { const x = 768 - camera; g.fillStyle(0xf8d394); g.fillEllipse(x, 204 + Math.sin(sim.time * 4) * 2, 15, 11); this.label(x - 18, 217, '+45 HP', 8, '#b9e7ad'); }
      const crate = (x:number,y:number,snack:boolean) => { r(x-12,y-23,24,23,0x493d35);r(x-10,y-21,20,19,0xbc915f);r(x-9,y-19,18,3,0xe2bb7e);r(x-9,y-8,18,3,0x75543c);r(x-3,y-20,5,19,0x79583f);if(snack)r(x-3,y-16,6,6,0xa8cc97); };
      for(const c of sim.crates) { const x=c.x-camera;g.fillStyle(0x101b24,.5);g.fillEllipse(x,c.y+2,31,9);crate(x,c.y,c.snack); if(Math.abs(c.x-sim.hero.x)<35 && Math.abs(c.y-sim.hero.y)<23 && !sim.carried) this.label(x-17,c.y-38,'攻击举起',8,'#ffe0a0'); }
      for(const s of sim.snacks) { const x=s.x-camera;r(x-7,s.y-9,14,9,0xe0b477);r(x-3,s.y-11,6,3,0xf6e4b2);this.label(x-12,s.y+4,'+30',8,'#bce6b0'); }
      const people = sim.phase === 'select' ? [sim.hero] : [...sim.enemies, sim.hero];
      people.filter(f => f.hp > 0 || f.dead > 0).sort((a, b) => a.y - b.y).forEach(f => this.person(f, f.x - camera + offset, f.y));
      if(sim.carried) { crate(sim.hero.x-camera+offset,sim.hero.y-61,sim.carried.snack);this.label(sim.hero.x-camera-30,sim.hero.y-96,'攻击扔出',8,'#ffe0a0'); }
      for(const s of sim.shots) { const x=s.x-camera; if(s.crate)crate(x,s.y-19,s.snack);else{r(x-4,s.y-30,8,10,0xf29c61);r(x-4,s.y-31,8,2,0xffe8ba);g.lineStyle(1,0xffd39e,.7);g.lineBetween(x-Math.sign(s.vx)*18,s.y-24,x,s.y-24);} }
      for (const s of sim.sparks) {
        const x = s.x - camera, y = s.y - (1 - s.life) * 13; this.label(x - 6, y, s.text, 12, '#ffedb1');
        if (/^\d/.test(s.text)) { g.lineStyle(2, 0xffebac, s.life * 2); for (let a = 0; a < 6; a++) { const angle = a * Math.PI / 3; g.lineBetween(x + Math.cos(angle) * 6, y + 18 + Math.sin(angle) * 6, x + Math.cos(angle) * 14, y + 18 + Math.sin(angle) * 14); } }
      }
      const live = sim.enemies.filter(e => e.hp > 0);
      if (sim.phase === 'playing' && sim.encounterClear) this.label(width / 2 - (sim.training ? 62 : 24), 120, sim.training ? '已清场 · 可重置陪练' : '前进 →', 15, '#ffe093');
      else if (sim.phase === 'playing' && !live.length && sim.pendingEnemies) this.label(width / 2 - 33, 120, '增援接近…', 12, '#ffe093');
      if (sim.training && sim.showRanges) {
        const p = sim.hero, x = p.x - camera + offset;
        const reach = sim.currentAttack?.reach ?? (p.motion === 'airborne' ? 63 : 48);
        g.lineStyle(1, 0xffc66f, .9);
        g.strokeRect(x + (p.face > 0 ? -9 : -reach), p.y - 23, reach + 9, 46);
        if (sim.currentAttack) {
          const height = sim.currentAttack.height;
          g.lineStyle(1, sim.attackPhase === 'active' ? 0xffffff : 0xffc66f, .8);
          g.strokeRect(x + (p.face > 0 ? -9 : -reach), p.y - p.height - height.high, reach + 9, height.high - height.low);
        }
        for (const f of [p, ...live]) {
          const fx = f.x - camera + offset;
          g.lineStyle(1, f === p ? 0x8adbc1 : 0xec8c93);
          g.lineBetween(fx - 5, f.y, fx + 5, f.y); g.lineBetween(fx, f.y - 5, fx, f.y + 5);
          g.strokeRect(fx - 10, f.y - f.height - 48, 20, 48);
          if (f !== p) this.label(fx - 23, f.y + 9, `${Math.round(f.knockbackAmount)}/${KNOCKBACK.threshold}`, 7, '#b4dacc');
        }
        this.label(8, 110, '黄框：地面攻击范围 / 十字：地面锚点', 8);
        this.label(8, 121, `竖框：身体高度 / ${sim.attackPhase ?? p.motion}`, 8);
      }
      // 开场提示和 Boss 血条由 DOM HUD 负责，画布只留战场内的信息。
    }
    person(f: Fighter, x: number, ground: number) {
      const g = this.ink; const isHero = f === sim.hero; const big = f.kind === 'boss' || f.kind === 'tank' || f.kind === 'tuo';
      const moving = isHero ? Math.hypot(sim.mx, sim.my) > .1 : f.timer < .9 && f.stun <= 0;
      const stride = moving && f.pose === 'idle' ? Math.sin(sim.time * (isHero && sim.running ? 21 : 13) + f.id) * (isHero && sim.running ? 7 : 5) : 0;
      const y = ground - f.height - (f.kind==='longleg'?5:0); const w = big ? 24 : 17; const face = f.face;
      const ENEMY_SHIRTS: Record<string, number> = { longleg: 0x6ec9bd, slinger: 0x7797af, boss: 0xb54f48, runner: 0x9981b0, tank: 0x6f8a73, blocker: 0x8a8f5c, grabber: 0xa8683f, luchuan: 0xd4785f, hanxiao: 0x4a5a86 };
      let shirt = isHero ? HEROES[sim.role].color : ENEMY_SHIRTS[f.kind] ?? 0x74849b;
      if (f.pose === 'hurt' && f.poseTime > .15) shirt = 0xffe9c6;
      if (isHero && (sim.running || f.pose === 'dash' || f.pose === 'slide')) {
        g.lineStyle(2, 0xe9c282, .45);
        g.lineBetween(x - face * 15, ground - 22, x - face * 35, ground - 22);
        g.lineBetween(x - face * 18, ground - 12, x - face * 43, ground - 12);
      }
      if (f.pose === 'hurt' || f.pose === 'held') shirt = 0xf5e4bd;
      const alpha = f.hp <= 0 ? f.dead / .65 : f.entryTime > 0 ? .4 : isHero && f.inv > 0 && Math.floor(sim.time * 18) % 2 ? .45 : 1;
      if (f.entryTime > 0) this.label(x - 15, y - 70, '入场中', 8, '#ffe093');
      if (sim.isBossVulnerable(f)) { g.lineStyle(2, 0x8adbc1, .8); g.strokeEllipse(x, ground + 1, 43, 13); }
      g.fillStyle(0x0c1523, .4); g.fillEllipse(x, ground + 1, (big ? 38 : 28) * Math.max(.65, 1 - f.height / 150), 9);
      const r = (a: number, b: number, c: number, d: number, color: number) => { g.fillStyle(color, alpha); g.fillRect(Math.round(x + (face === 1 ? a : -a - c)), Math.round(y + b), c, d); };
      if (f.hp <= 0 || f.motion === 'launched' || f.motion === 'downed') { r(-20, -12, 32, 12, shirt); r(12, -13, 11, 12, 0xdfa77d); r(-27, -10, 9, 8, 0x1b2635); return; }
      if (f.guard > 0) {
        // Sidestep stance: readable as "about to answer", not as an idle pause.
        g.lineStyle(2, 0x9edbd5, .6); g.strokeEllipse(x, ground + 1, 44, 13);
        this.label(x - 18, y - 70, '侧移', 9, '#9edbd5');
        r(-w / 2 - 1, -34, w + 2, 21, 0x172332); r(-w / 2, -35, w, 20, shirt);
        r(-7, -52, 16, 17, 0xe0ab80); r(-8, -53, 17, 5, 0x282832);
        r(-w / 2 - 5, -34, 7, 12, shirt); r(-w / 2 - 5, -24, 7, 8, 0xe0ab80);
        r(2, -36, 9, 11, shirt); r(6, -45, 8, 9, 0xe0ab80);
        r(-9, -14, 8, 14, 0x263749); r(3, -14, 8, 14, 0x344b5b);
        r(-11, -3, 11, 4, 0x171f2a); r(3, -3, 12, 4, 0x171f2a);
        return;
      }
      if (f.pose === 'slide') {
        // Low horizontal silhouette: lead leg out front, dust kicked up behind the hip.
        g.fillStyle(0xd8c7a4, .3); g.fillEllipse(x - face * 14, ground + 2, 46, 8);
        r(-17, -21, 25, 18, 0x172332);
        r(-16, -20, 23, 16, shirt);
        r(2, -15, 26, 8, 0x263749); r(26, -17, 9, 10, 0xe4c58e);
        r(-2, -24, 18, 7, 0x344b5b);
        r(-24, -15, 11, 7, shirt); r(-31, -14, 8, 6, 0xe0ab80);
        r(-23, -32, 16, 15, 0xe0ab80); r(-24, -33, 17, 5, 0x282832); r(-12, -27, 3, 3, 0x252434);
        g.lineStyle(2, 0xe9c282, .5);
        g.lineBetween(x - face * 22, ground - 6, x - face * 46, ground - 6);
        g.lineBetween(x - face * 26, ground - 16, x - face * 44, ground - 16);
        return;
      }
      if (f.pose === 'dodge' || ['takeoff', 'landing', 'rising'].includes(f.motion)) {
        // Low defensive silhouette, distinct from the forward dash attack.
        if (f.pose === 'dodge') { g.lineStyle(2, 0x9edbd5, .55); g.strokeEllipse(x, ground, 42, 10); }
        r(-14, -29, w + 5, 17, shirt);
        r(-12, -45, 16, 16, 0xe0ab80); r(-13, -46, 17, 5, 0x282832);
        r(3, -30, 8, 8, 0xe0ab80);
        r(-17, -13, 9, 13, 0x263749); r(1, -13, 17, 8, 0x344b5b);
        r(-20, -4, 12, 4, 0x171f2a); r(12, -6, 12, 4, 0x171f2a);
        return;
      }
      if (f.wind > 0) { g.lineStyle(2, 0xfaa36e, .9); g.strokeEllipse(x, ground + 1, 43, 13); this.label(x - 3, y - 68, '!', 17, '#ffbe76'); if (f.kind === 'boss') { g.fillStyle(0xee6356, .17); g.fillRect(face > 0 ? x : x - 155, ground - 12, 155, 25); } }
      if(f.kind==='longleg' && f.wind>0){g.fillStyle(0xffaa64,.2);g.fillRect(face>0?x:x-105,ground-24,105,48);this.label(x-20,y-83,'长踢预警',8,'#ffd88e');}
      if (f.wind > 0) {
        // Chapter 3/4 bosses announce which of their strings is coming, not just that one is.
        const move = sim.bossPendingMove(f);
        if (move) {
          const rules = f.kind === 'hanxiao' ? BOSS_RULES.hanxiao : BOSS_RULES.luchuan;
          const span = move === 'charge' ? 155 : move === 'kick' ? BOSS_RULES.hanxiao.kickReach : rules.reach;
          const name = move === 'charge' ? '冲撞预警' : move === 'kick' ? '长踢预警' : '连拳预警';
          g.fillStyle(move === 'charge' ? 0xee6356 : 0xffaa64, move === 'charge' ? .17 : .2);
          g.fillRect(face > 0 ? x : x - span, ground - (move === 'kick' ? 24 : 14), span, move === 'kick' ? 48 : 28);
          this.label(x - 20, y - 83, name, 8, '#ffd88e');
        }
      }
      if (f.pose === 'charge' && CHARGES[f.kind] && !isHero) { g.lineStyle(2, 0xffb27a, .5); g.lineBetween(x - face * 14, ground - 26, x - face * 40, ground - 26); }
      if (f.pose === 'special') { g.lineStyle(5, HEROES[sim.role].color, .7); g.strokeEllipse(x, y - 25, 110 + Math.sin(sim.time * 40) * 10, 55); }
      r(-w / 2 - 1, -36, w + 2, 23, 0x172332); r(-w / 2, -37, w, 22, shirt);
      r(-w / 2, -37, 5, 19, 0x283a49); r(-7, -15, 7, 13 + stride, 0x263749); r(2, -15, 7, 13 - stride, 0x344b5b);
      r(-8, -3 + stride, 10, 4, 0x171f2a); r(2, -3 - stride, 12, 4, 0x171f2a);
      r(-7, -54, 16, 17, 0xe0ab80); r(-8, -55, 17, 5, 0x282832); r(-8, -51, 4, 8, 0x282832); r(5, -48, 3, 3, 0x252434); r(6, -40, 5, 2, 0xa66a54);
      if (f.kind === 'man' || f.kind === 'runner') r(-8, -52, 18, 3, 0xe0b375);
      if(f.kind==='slinger'){r(-9,-58,18,8,0xbea15d);r(7,-53,9,3,0xbea15d);r(-12,-17,9,12,0x9a7753);}
      if(f.kind==='longleg')r(-8,-52,18,3,0xe88966);
      if (big) { r(-7, -41, 15, 3, 0x3e3031); r(-11, -33, 7, 17, 0xdba077); }
      // Raised forearm guard, dropped while it winds up or flinches.
      if (f.kind === 'blocker' && f.wind <= 0 && f.stun <= 0 && f.pose !== 'punch') { r(9, -48, 7, 28, 0x5b6146); r(10, -47, 5, 4, 0xc8c09a); }
      const attack = ['punch', 'kick', 'uppercut', 'throw', 'charge', 'dash', 'lunge'].includes(f.pose);
      r(-w / 2 - 4, -32, 6, 14, shirt); r(-w / 2 - 4, -20, 6, 7, 0xe0ab80);
      if (attack && isHero && sim.attackPhase === 'recover') {
        r(6, -33, 10, 7, shirt); r(13, -31, 8, 9, 0xe0ab80);
      } else if (attack && isHero && sim.windingUp) {
        r(3, -35, 10, 7, shirt); r(9, -39, 8, 9, 0xe0ab80);
      } else if (attack) {
        if (f.pose === 'kick') { r(7, -20, f.kind==='longleg'?82:24, 8, 0x344b5b); r(f.kind==='longleg'?87:28, -21, 9, 10, 0xe4c58e); }
        else if (f.pose === 'uppercut') { r(10, -41, 7, 14, shirt); r(11, -51, 9, 11, 0xe0ab80); }
        else { r(8, -33, 21, 7, shirt); r(27, -35, 9, 10, 0xe0ab80); }
        g.lineStyle(2, 0xfbe6b1, .6); g.lineBetween(x + face * 20, y - 23, x + face * 39, y - 27);
      } else { r(w / 2 - 2, -32, 7, 13, shirt); r(w / 2, -22, 7, 7, 0xe0ab80); }
      if (f.pose === 'grab') { r(6,-35,18,7,shirt); r(22,-36,8,8,0xe0ab80); r(6,-26,18,7,shirt); r(22,-27,8,8,0xe0ab80); }
      if(isHero && sim.carried){r(-15,-58,6,30,shirt);r(10,-58,6,30,shirt);r(-15,-64,6,7,0xe0ab80);r(10,-64,6,7,0xe0ab80);}
      if (!isHero && f.hp < f.max) { g.fillStyle(0x172331); g.fillRect(x - 13, y - 62, 26, 3); g.fillStyle(0xe89d77); g.fillRect(x - 13, y - 62, 26 * f.hp / f.max, 3); }
      if (isHero && sim.heldBy) this.label(x - 22, y - 82, '连按挣脱', 9, '#ffb27a');
      if (isHero) { g.fillStyle(HEROES[sim.role].color); g.fillTriangle(x - 4, y - 67, x + 4, y - 67, x, y - 63); }
    }
  }
  const viewportWidth = () => Math.max(480, Math.min(1440, Math.round(270 * parent.clientWidth / Math.max(1, parent.clientHeight))));
  const game = new Phaser.Game({ type: Phaser.AUTO, width: viewportWidth(), height: 270, parent, backgroundColor: '#172331', pixelArt: true, antialias: false, audio: { noAudio: true }, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: StreetScene, banner: false });
  const resize = new ResizeObserver(() => {
    const width = viewportWidth();
    if (game.scale.gameSize.width !== width) game.scale.setGameSize(width, 270);
    game.scale.refresh();
  });
  game.events.once(Phaser.Core.Events.READY, () => resize.observe(parent));
  game.events.once(Phaser.Core.Events.DESTROY, () => resize.disconnect());
  return game;
}

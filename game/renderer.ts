import * as Phaser from 'phaser';
import { CargoRun, SHELVES, WORLD, type Controls, type RunSnapshot } from './simulation';

export function createGame(parent: HTMLElement, run: CargoRun, controls: Controls, publish: (s: RunSnapshot) => void, sound: (kind: string) => void, ready: () => void) {
  class WarehouseScene extends Phaser.Scene {
    private objects = new Map<number, Phaser.GameObjects.Image>();
    private engine!: Phaser.GameObjects.Image;
    private links!: Phaser.GameObjects.Graphics;
    private gate!: Phaser.GameObjects.Graphics;
    private gateText!: Phaser.GameObjects.Text;
    private lastPublish = 0;
    private lastPhase = '';
    constructor() { super('warehouse'); }
    create() {
      this.texturesForGame(); this.drawWarehouse();
      this.links = this.add.graphics().setDepth(4);
      for (const cargo of run.loose) this.objects.set(cargo.id, this.add.image(cargo.x,cargo.y,cargo.gold ? 'gold' : 'cargo').setDepth(6));
      this.engine = this.add.image(run.head.x,run.head.y,'truck').setDepth(8);
      this.gate = this.add.graphics().setDepth(3);
      this.gateText = this.add.text(220,60,'集齐 6 节开启', { fontFamily: 'Arial, Microsoft YaHei', fontSize: '12px', color: '#b9cfbc', fontStyle: 'bold' }).setOrigin(.5).setDepth(3);
      ready();
    }
    private texturesForGame() {
      const g = this.make.graphics({x:0,y:0});
      // Compact functional sprites: hitch, wheels, payload and cab are readable at phone scale.
      for (const gold of [false,true]) {
        g.clear(); g.fillStyle(0x071c22,.3); g.fillRoundedRect(7,8,24,23,4);
        g.fillStyle(0x13272b); g.fillRoundedRect(8,3,7,5,2); g.fillRoundedRect(8,25,7,5,2);
        g.fillStyle(0x597475); g.fillRoundedRect(4,7,26,19,3);
        g.fillStyle(gold ? 0xffd064 : 0xec9d66); g.fillRoundedRect(6,8,21,16,3);
        g.fillStyle(gold ? 0xffe697 : 0xf8bd85); g.fillRect(8,9,17,4);
        g.fillStyle(gold ? 0xad792b : 0xa96243); g.fillRect(15,8,3,16);
        g.fillStyle(0xc4d2bf); g.fillRect(0,15,5,3); g.fillRect(29,15,5,3);
        if (gold) { g.fillStyle(0xfff3ba); g.fillCircle(21,19,2); }
        g.generateTexture(gold ? 'gold' : 'cargo',34,34);
      }
      g.clear(); g.fillStyle(0x071c22,.4); g.fillRoundedRect(7,8,31,26,7);
      g.fillStyle(0x0a1b20); g.fillRoundedRect(8,2,10,7,2); g.fillRoundedRect(8,28,10,7,2); g.fillRoundedRect(28,3,8,6,2); g.fillRoundedRect(28,28,8,6,2);
      g.fillStyle(0x749843); g.fillRoundedRect(4,8,33,22,5); g.fillStyle(0xc5f763); g.fillRoundedRect(4,6,33,23,5);
      g.fillStyle(0xe1ffa1); g.fillRect(25,8,9,19); g.fillStyle(0x234f54); g.fillRoundedRect(19,9,8,17,2);
      g.fillStyle(0x6ea6a0); g.fillRect(20,10,3,15); g.fillStyle(0x7da24b); g.fillRect(8,11,7,13);
      g.fillStyle(0xfff5b0); g.fillRect(34,8,3,5); g.fillRect(34,23,3,5); g.fillStyle(0xff9666); g.fillRect(3,9,3,4); g.fillRect(3,24,3,4);
      g.generateTexture('truck',42,38); g.destroy();
    }
    private drawWarehouse() {
      const g = this.add.graphics();
      g.fillStyle(0x395250); g.fillRect(0,0,440,660);
      g.fillStyle(0x4c6258); g.fillRoundedRect(22,46,396,592,9);
      g.lineStyle(1,0x5d7363,.45);
      for (let x=40;x<420;x+=32) g.lineBetween(x,48,x,636);
      for (let y=60;y<638;y+=32) g.lineBetween(24,y,416,y);
      g.lineStyle(2,0x8c9b6a,.35); g.strokeRoundedRect(53,84,335,520,22);
      g.lineStyle(1,0xa1ae83,.4);
      for (let y=130;y<590;y+=40) { g.lineBetween(111,y,111,y+17); g.lineBetween(347,y,347,y+17); }
      g.fillStyle(0x203d40); g.fillRect(12,42,172,12); g.fillRect(256,42,172,12); g.fillRect(12,42,12,608); g.fillRect(416,42,12,608); g.fillRect(12,638,416,12);
      g.fillStyle(0xa8b775,.7);
      for(let x=32;x<410;x+=24) { g.fillRect(x,633,12,4); if(x<175 || x>255)g.fillRect(x,55,12,4); }
      for (const [i,r] of SHELVES.entries()) {
        g.fillStyle(0x102e32,.3); g.fillRoundedRect(r.x+5,r.y+8,r.w,r.h,4);
        g.fillStyle(0x243c3e); g.fillRoundedRect(r.x,r.y,r.w,r.h,3);
        g.fillStyle(0x718478); g.fillRect(r.x,r.y,r.w,5);
        for(let y=r.y+10;y<r.y+r.h-15;y+=30) {
          g.fillStyle(0x9f8e6e); g.fillRoundedRect(r.x+5,y,18,22,2); g.fillStyle(0xb4a37d); g.fillRoundedRect(r.x+27,y,19,22,2);
          g.fillStyle(0xc6b794,.5); g.fillRect(r.x+12,y,3,22); g.fillRect(r.x+35,y,3,22);
          g.fillStyle(0x547371); g.fillRect(r.x,y+24,r.w,4);
        }
        g.fillStyle(0xf0b862); g.fillRect(r.x,r.y,3,r.h); g.fillRect(r.x+r.w-3,r.y,3,r.h);
        this.add.text(r.x+r.w/2,r.y+r.h+14,`A–0${i+1}`,{fontSize:'10px',color:'#afbd9c',fontFamily:'Arial'}).setOrigin(.5);
      }
      g.lineStyle(2,0xc5f763,.3); g.strokeRoundedRect(53,550,51,58,5);
      this.add.text(79,618,'START',{fontSize:'10px',color:'#bfd79c',fontFamily:'Arial'}).setOrigin(.5);
      this.add.text(220,610,'LAST LOAD / 最后一趟',{fontSize:'12px',color:'#9aac90',fontFamily:'Arial, Microsoft YaHei'}).setOrigin(.5);
      this.add.text(218,484,'↑',{fontSize:'27px',color:'#a0b492',fontFamily:'Arial'}).setOrigin(.5).setAlpha(.5);
    }
    update(time: number, delta: number) {
      run.update(delta/1000,controls);
      this.engine.setPosition(run.head.x,run.head.y).setRotation(run.head.angle);
      this.links.clear(); this.links.lineStyle(3,0x233936);
      let lead = run.head;
      const attached = new Set(run.cargo.map(c=>c.id));
      for(const c of run.cargo) { this.links.lineBetween(lead.x,lead.y,c.x,c.y); lead=c; }
      for(const c of [...run.loose,...run.cargo]) {
        const sprite = this.objects.get(c.id)!;
        sprite.setPosition(c.x,c.y).setRotation(c.angle).setVisible(c.y>-40);
        if(c.stress>0.08) sprite.setTint(0xff7958); else sprite.clearTint();
        sprite.setAlpha(attached.has(c.id) ? 1 : .85 + Math.sin(time/280+c.id)*.12);
      }
      this.gate.clear();
      const open = run.cargo.length>=WORLD.goal;
      this.gate.fillStyle(open ? 0xbafa68 : 0x56756b,open ? .8 + Math.sin(time/200)*.15 : 1);
      this.gate.fillRoundedRect(184,38,72,12,3);
      if(open) { this.gate.fillStyle(0xc5f763,.15); this.gate.fillRect(184,0,72,95); this.gate.fillStyle(0xd9ffad); this.gate.fillTriangle(220,17,211,29,229,29); }
      this.gateText.setText(open ? '↑  撤离出口' : '集齐 6 节开启').setColor(open ? '#e7ffbc' : '#bfcebc');
      for(const event of run.events.splice(0)) {
        sound(event.kind);
        const color = event.kind==='drop' || event.kind==='bump' ? 0xff9972 : 0xd7ff87;
        const ring = this.add.circle(event.x,event.y,10).setStrokeStyle(3,color).setDepth(10);
        this.tweens.add({targets:ring,scale:2.8,alpha:0,duration:400,onComplete:()=>ring.destroy()});
        if(event.kind==='pickup') {
          const label = this.add.text(event.x,event.y-20,event.gold ? '+30' : '+10',{fontSize:'17px',fontStyle:'bold',color:event.gold?'#ffe69c':'#e5ffb2',stroke:'#243c37',strokeThickness:3}).setOrigin(.5).setDepth(10);
          this.tweens.add({targets:label,y:event.y-47,alpha:0,duration:700,onComplete:()=>label.destroy()});
        }
        if(event.kind==='drop') this.cameras.main.shake(120,.002);
      }
      if(time-this.lastPublish>80 || run.phase!==this.lastPhase) { this.lastPublish=time; this.lastPhase=run.phase; publish(run.snapshot()); }
    }
  }
  return new Phaser.Game({type:Phaser.AUTO,parent,width:WORLD.width,height:WORLD.height,backgroundColor:'#395250',
    scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[WarehouseScene],
    render:{antialias:true,roundPixels:false},audio:{noAudio:true},banner:false});
}

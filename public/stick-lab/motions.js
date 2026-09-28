// Angles are absolute canvas angles in degrees (positive points down).
// The renderer merges every individual pose with REST before interpolation.
// x/y offset the hip; lean is measured clockwise from the upward direction.
// A frame's ease describes the incoming segment, from the previous frame.
export const REST = {
  x: 0, y: 0, lean: 8,
  fu: 35, fl: -85, bu: 110, bl: -55,
  ft: 65, fs: 95, bt: 115, bs: 80,
};

export const CLIPS = {
  idle: {
    name: '戒备', duration: 1.6, loop: true,
    description: '双手护脸，重心轻轻起伏。',
    frames: [
      { t: 0, pose: { y: -2 }, ease: 'inout' },
      { t: 0.4, pose: { y: -3, lean: 7, fu: 32, fl: -88, bu: 108, bl: -57, ft: 67, fs: 94, bt: 113, bs: 82 }, ease: 'inout' },
      { t: 0.8, pose: { y: -2, lean: 8, fu: 34, fl: -86, bu: 110, bl: -56 }, ease: 'inout' },
      { t: 1.2, pose: { y: -1, lean: 9, fu: 37, fl: -82, bu: 112, bl: -53, ft: 63, fs: 96, bt: 117, bs: 78 }, ease: 'inout' },
      { t: 1.6, pose: { y: -2 }, ease: 'inout' },
    ],
  },
  walk: {
    name: '走步', duration: 0.72, loop: true,
    description: '交替落脚，摆臂与迈腿相反。',
    frames: [
      { t: 0, pose: { y: -2, lean: 9, fu: 108, fl: -63, bu: 40, bl: -86, ft: 60, fs: 85, bt: 110, bs: 100 }, ease: 'linear' },
      { t: 0.18, pose: { y: -6, lean: 7, fu: 75, fl: -72, bu: 75, bl: -72, ft: 90, fs: 90, bt: 65, bs: 125 }, ease: 'linear' },
      { t: 0.36, pose: { y: -2, lean: 9, fu: 40, fl: -86, bu: 108, bl: -63, ft: 110, fs: 100, bt: 60, bs: 85 }, ease: 'linear' },
      { t: 0.54, pose: { y: -6, lean: 7, fu: 75, fl: -72, bu: 75, bl: -72, ft: 65, fs: 125, bt: 90, bs: 90 }, ease: 'linear' },
      { t: 0.72, pose: { y: -2, lean: 9, fu: 108, fl: -63, bu: 40, bl: -86, ft: 60, fs: 85, bt: 110, bs: 100 }, ease: 'linear' },
    ],
  },
  run: {
    name: '奔跑', duration: 0.52, loop: true,
    description: '前倾冲刺，蹬地后短暂腾空。',
    frames: [
      { t: 0, pose: { y: 2, lean: 18, fu: 115, fl: -38, bu: 20, bl: -65, ft: 53, fs: 76, bt: 135, bs: 50 }, ease: 'linear' },
      { t: 0.08, pose: { y: -5, lean: 20, fu: 84, fl: -64, bu: 57, bl: -86, ft: 85, fs: 100, bt: 60, bs: 150 }, ease: 'linear' },
      { t: 0.17, pose: { y: -12, lean: 18, fu: 30, fl: -80, bu: 125, bl: -30, ft: 120, fs: 135, bt: 5, bs: 110 }, ease: 'linear' },
      { t: 0.26, pose: { y: 2, lean: 18, fu: 20, fl: -65, bu: 115, bl: -38, ft: 135, fs: 50, bt: 53, bs: 76 }, ease: 'linear' },
      { t: 0.34, pose: { y: -5, lean: 20, fu: 57, fl: -86, bu: 84, bl: -64, ft: 60, fs: 150, bt: 85, bs: 100 }, ease: 'linear' },
      { t: 0.43, pose: { y: -12, lean: 18, fu: 125, fl: -30, bu: 30, bl: -80, ft: 5, fs: 110, bt: 120, bs: 135 }, ease: 'linear' },
      { t: 0.52, pose: { y: 2, lean: 18, fu: 115, fl: -38, bu: 20, bl: -65, ft: 53, fs: 76, bt: 135, bs: 50 }, ease: 'linear' },
    ],
  },
  jab: {
    name: '刺拳', duration: 0.27, loop: false, hit: 0.05,
    description: '前手直出，接触后迅速回到护脸位。',
    frames: [
      { t: 0, pose: {}, ease: 'linear' },
      { t: 0.025, pose: { x: -2, y: -2, lean: 3, fu: 48, fl: -93, bu: 113, bl: -59 }, ease: 'out' },
      { t: 0.05, pose: { x: 9, y: -2, lean: 18, fu: -8, fl: -6, bu: 102, bl: -75, ft: 60, fs: 86, bt: 117, bs: 71 }, ease: 'out' },
      { t: 0.075, pose: { x: 11, y: -2, lean: 20, fu: -7, fl: -5, bu: 100, bl: -77, ft: 59, fs: 86, bt: 118, bs: 71 }, ease: 'inout' },
      { t: 0.15, pose: { x: 3, y: -2, lean: 10, fu: 20, fl: -95, bu: 107, bl: -64 }, ease: 'inout' },
      { t: 0.27, pose: {}, ease: 'inout' },
    ],
  },
  cross: {
    name: '后手直拳', duration: 0.27, loop: false, hit: 0.06,
    description: '后肩送出重拳，前手留在面前。',
    frames: [
      { t: 0, pose: {}, ease: 'linear' },
      { t: 0.03, pose: { x: -3, y: -2, lean: -2, fu: 30, fl: -88, bu: 134, bl: -37, ft: 70, fs: 95, bt: 112, bs: 79 }, ease: 'out' },
      { t: 0.06, pose: { x: 11, y: -2, lean: 24, fu: 105, fl: -82, bu: -8, bl: -3, ft: 62, fs: 87, bt: 124, bs: 73 }, ease: 'out' },
      { t: 0.09, pose: { x: 14, y: -2, lean: 27, fu: 103, fl: -84, bu: -7, bl: -2, ft: 60, fs: 86, bt: 128, bs: 72 }, ease: 'inout' },
      { t: 0.18, pose: { x: 4, y: -2, lean: 12, fu: 43, fl: -88, bu: 69, bl: -88 }, ease: 'inout' },
      { t: 0.27, pose: {}, ease: 'inout' },
    ],
  },
  uppercut: {
    name: '上勾拳', duration: 0.34, loop: false, hit: 0.075,
    description: '屈膝蓄力，蹬腿把前拳送向上方。',
    frames: [
      { t: 0, pose: {}, ease: 'linear' },
      { t: 0.035, pose: { x: -3, y: 12, lean: 18, fu: 65, fl: -40, bu: 104, bl: -78, ft: 40, fs: 125, bt: 140, bs: 55 }, ease: 'out' },
      { t: 0.075, pose: { x: 12, y: -5, lean: 18, fu: 15, fl: -75, bu: 105, bl: -82, ft: 80, fs: 91, bt: 115, bs: 77 }, ease: 'out' },
      { t: 0.105, pose: { x: 12, y: -7, lean: 10, fu: -25, fl: -82, bu: 106, bl: -79, ft: 84, fs: 92, bt: 111, bs: 80 }, ease: 'inout' },
      { t: 0.19, pose: { x: 4, y: -3, lean: 2, fu: -22, fl: -105, bu: 108, bl: -69, ft: 72, fs: 95, bt: 115, bs: 80 }, ease: 'inout' },
      { t: 0.27, pose: { x: 1, y: -1, lean: 6, fu: 24, fl: -94, bu: 110, bl: -58 }, ease: 'inout' },
      { t: 0.34, pose: {}, ease: 'inout' },
    ],
  },
  kick: {
    name: '前踢', duration: 0.52, loop: false, hit: 0.18,
    description: '提膝、伸腿、收膝，再落回架势。',
    frames: [
      { t: 0, pose: {}, ease: 'inout' },
      { t: 0.06, pose: { x: -3, y: -3, lean: -6, fu: 45, fl: -102, bu: 120, bl: -67, ft: 45, fs: 140, bt: 101, bs: 86 }, ease: 'inout' },
      { t: 0.12, pose: { x: -2, y: -3, lean: -12, fu: 58, fl: -112, bu: 133, bl: -70, ft: -55, fs: 85, bt: 101, bs: 86 }, ease: 'out' },
      { t: 0.18, pose: { x: 4, y: -3, lean: -18, fu: 65, fl: -118, bu: 144, bl: -49, ft: -22, fs: -8, bt: 101, bs: 86 }, ease: 'out' },
      { t: 0.23, pose: { x: 5, y: -3, lean: -19, fu: 68, fl: -117, bu: 146, bl: -45, ft: -20, fs: -6, bt: 101, bs: 86 }, ease: 'inout' },
      { t: 0.32, pose: { x: 1, y: -3, lean: -10, fu: 54, fl: -106, bu: 128, bl: -64, ft: -50, fs: 80, bt: 101, bs: 86 }, ease: 'inout' },
      { t: 0.43, pose: { x: 0, y: -3, lean: 4, fu: 40, fl: -91, bu: 116, bl: -59, ft: 70, fs: 100, bt: 111, bs: 82 }, ease: 'inout' },
      { t: 0.52, pose: {}, ease: 'inout' },
    ],
  },
  dodge: {
    name: '闪避', duration: 0.34, loop: false,
    description: '屈膝后撤，把头部移出直拳路线。',
    frames: [
      { t: 0, pose: {}, ease: 'out' },
      { t: 0.055, pose: { x: -9, y: 7, lean: -19, fu: 49, fl: -106, bu: 109, bl: -76, ft: 48, fs: 124, bt: 132, bs: 56 }, ease: 'out' },
      { t: 0.105, pose: { x: -16, y: 15, lean: -32, fu: 58, fl: -116, bu: 112, bl: -84, ft: 35, fs: 120, bt: 145, bs: 60 }, ease: 'linear' },
      { t: 0.16, pose: { x: -15, y: 15, lean: -30, fu: 56, fl: -114, bu: 112, bl: -83, ft: 35, fs: 120, bt: 145, bs: 60 }, ease: 'inout' },
      { t: 0.25, pose: { x: -5, y: 5, lean: -6, fu: 43, fl: -97, bu: 110, bl: -68, ft: 53, fs: 110, bt: 127, bs: 70 }, ease: 'inout' },
      { t: 0.34, pose: {}, ease: 'inout' },
    ],
  },
  tornado: {
    name: '龙卷风', duration: 0.4, loop: false, hit: 0.12,
    description: '双手收回身侧蓄力，向前推掌放出龙卷风。',
    frames: [
      { t: 0, pose: {}, ease: 'linear' },
      { t: 0.04, pose: { x: -5, y: 3, lean: -9, fu: 110, fl: -25, bu: 133, bl: -20, ft: 53, fs: 110, bt: 127, bs: 70 }, ease: 'inout' },
      { t: 0.085, pose: { x: -7, y: 7, lean: -16, fu: 120, fl: -18, bu: 145, bl: -30, ft: 48, fs: 114, bt: 132, bs: 66 }, ease: 'inout' },
      { t: 0.12, pose: { x: 10, y: -2, lean: 22, fu: -4, fl: -4, bu: 12, bl: 5, ft: 62, fs: 86, bt: 123, bs: 75 }, ease: 'out' },
      { t: 0.16, pose: { x: 13, y: -2, lean: 25, fu: -5, fl: -3, bu: 8, bl: 5, ft: 60, fs: 86, bt: 126, bs: 75 }, ease: 'linear' },
      { t: 0.23, pose: { x: 10, y: -2, lean: 21, fu: 8, fl: -16, bu: 22, bl: -12, ft: 61, fs: 88, bt: 120, bs: 78 }, ease: 'inout' },
      { t: 0.32, pose: { x: 3, y: -2, lean: 12, fu: 43, fl: -65, bu: 82, bl: -50, ft: 64, fs: 93, bt: 116, bs: 79 }, ease: 'inout' },
      { t: 0.4, pose: {}, ease: 'inout' },
    ],
  },
  hurt: {
    name: '受击', duration: 0.4, loop: false,
    description: '胸口后仰，屈膝吸收冲击再稳住。',
    frames: [
      { t: 0, pose: {}, ease: 'out' },
      { t: 0.045, pose: { x: -8, y: -6, lean: -25, fu: -48, fl: -105, bu: 145, bl: -18, ft: 80, fs: 90, bt: 100, bs: 84 }, ease: 'out' },
      { t: 0.09, pose: { x: -12, y: 3, lean: -32, fu: -32, fl: -119, bu: 146, bl: -24, ft: 55, fs: 112, bt: 125, bs: 65 }, ease: 'inout' },
      { t: 0.18, pose: { x: -6, y: 6, lean: -14, fu: 18, fl: -104, bu: 126, bl: -45, ft: 50, fs: 122, bt: 130, bs: 60 }, ease: 'inout' },
      { t: 0.28, pose: { x: -2, y: -1, lean: 3, fu: 31, fl: -91, bu: 113, bl: -59 }, ease: 'inout' },
      { t: 0.4, pose: {}, ease: 'inout' },
    ],
  },
  knockdown: {
    name: '击倒', duration: 0.8, loop: false,
    description: '向后失衡，背部落地后保持倒地。',
    frames: [
      { t: 0, pose: {}, ease: 'out' },
      { t: 0.06, pose: { x: -8, y: -7, lean: -30, fu: -35, fl: -100, bu: 140, bl: -40, ft: 72, fs: 98, bt: 100, bs: 76 }, ease: 'linear' },
      { t: 0.16, pose: { x: -21, y: -9, lean: -56, fu: -58, fl: -119, bu: 131, bl: -74, ft: 36, fs: 82, bt: 100, bs: 45 }, ease: 'linear' },
      { t: 0.3, pose: { x: -34, y: 14, lean: -75, fu: -34, fl: -76, bu: 74, bl: -32, ft: 14, fs: 42, bt: 43, bs: 12 }, ease: 'linear' },
      { t: 0.47, pose: { x: -42, y: 53, lean: -88, fu: 18, fl: 2, bu: -20, bl: 31, ft: 12, fs: 2, bt: -12, bs: 30 }, ease: 'out' },
      { t: 0.54, pose: { x: -44, y: 55, lean: -90, fu: 22, fl: 0, bu: -25, bl: 35, ft: 3, fs: 17, bt: -8, bs: 30 }, ease: 'inout' },
      { t: 0.64, pose: { x: -44, y: 52, lean: -88, fu: 18, fl: -3, bu: -27, bl: 32, ft: 2, fs: 18, bt: -10, bs: 28 }, ease: 'inout' },
      { t: 0.8, pose: { x: -44, y: 55, lean: -90, fu: 20, fl: 5, bu: -25, bl: 35, ft: 0, fs: 18, bt: -8, bs: 30 }, ease: 'linear' },
    ],
  },
};

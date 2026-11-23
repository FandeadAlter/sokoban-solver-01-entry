// Sokoban solver: room decomposition + push-optimal BFS per room.
// Node 22+, stdlib only. Reads /input/<id>/level.txt, writes /output/<id>/solution.txt.
// A level is a hallway (the player's row) with 1-4 rooms off it; a box pushed into the
// hallway never comes back, so each room is solved on its own and the optima add up.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const MAX_STATES = 250_000;
// [dx, dy, walk letter, push letter]
const DIRS: [number, number, string, string][] = [[0, -1, 'u', 'U'], [0, 1, 'd', 'D'], [-1, 0, 'l', 'L'], [1, 0, 'r', 'R']];

interface Board { w: number; h: number; wall: Uint8Array; goals: number[]; boxes: number[]; player: number }

function parse(text: string): Board {
  const rows = text.split('\n').filter((r) => r.length > 0);
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const wall = new Uint8Array(w * h).fill(1);
  const goals: number[] = [];
  const boxes: number[] = [];
  let player = -1;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      const i = y * w + x;
      if (ch === '#') continue;
      wall[i] = 0;
      if (ch === '.' || ch === '*' || ch === '+') goals.push(i);
      if (ch === '$' || ch === '*') boxes.push(i);
      if (ch === '@' || ch === '+') player = i;
    }
  });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) wall[y * w + x] = 1;
  return { w, h, wall, goals, boxes: boxes.sort((a, b) => a - b), player };
}

// Squares from which a box can still be pushed onto some goal, pulled back from the goals.
function liveSquares(b: Board): Uint8Array {
  const live = new Uint8Array(b.w * b.h);
  const queue = [...b.goals];
  for (const g of b.goals) live[g] = 1;
  for (let qi = 0; qi < queue.length; qi++) {
    const x = queue[qi]!;
    for (const [dx, dy] of DIRS) {
      const d = dy * b.w + dx;
      const y = x - d;
      if (!b.wall[y] && !b.wall[y - d] && !live[y]) { live[y] = 1; queue.push(y); }
    }
  }
  return live;
}

// Cells the player reaches from `from` with `occupied` in the way; also the lowest of them.
function reach(b: Board, occupied: Uint8Array, from: number): { seen: Uint8Array; low: number } {
  const seen = new Uint8Array(b.w * b.h);
  const stack = [from];
  seen[from] = 1;
  let low = from;
  while (stack.length > 0) {
    const p = stack.pop()!;
    if (p < low) low = p;
    for (const [dx, dy] of DIRS) {
      const q = p + dy * b.w + dx;
      if (!b.wall[q] && !occupied[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
    }
  }
  return { seen, low };
}

// Whether the box just pushed to `t` sits in a frozen 2x2 block (walls and boxes, a box off its goal).
function frozen(b: Board, occupied: Uint8Array, goal: Uint8Array, t: number): boolean {
  for (const a of [t, t - 1, t - b.w, t - b.w - 1]) {
    if (a % b.w === b.w - 1) continue; // block would wrap to the next row
    const cells = [a, a + 1, a + b.w, a + b.w + 1];
    if (!cells.every((c) => b.wall[c] || occupied[c])) continue;
    if (cells.some((c) => occupied[c] && !goal[c])) return true;
  }
  return false;
}

// Shortest walk from `from` to `to` around walls and boxes; null when unreachable.
function walkTo(b: Board, occupied: Uint8Array, from: number, to: number): string | null {
  if (from === to) return '';
  const prev = new Int32Array(b.w * b.h).fill(-1);
  const how: string[] = new Array(b.w * b.h);
  const queue = [from];
  prev[from] = from;
  for (let qi = 0; qi < queue.length; qi++) {
    const p = queue[qi]!;
    if (p === to) break;
    for (const [dx, dy, letter] of DIRS) {
      const q = p + dy * b.w + dx;
      if (b.wall[q] || occupied[q] || prev[q] !== -1) continue;
      prev[q] = p;
      how[q] = letter;
      queue.push(q);
    }
  }
  if (prev[to] === -1) return null;
  let s = '';
  for (let p = to; p !== from; p = prev[p]!) s = how[p]! + s;
  return s;
}

// Push-optimal solution of one board: BFS over pushes (first solved state found is optimal).
// Returns {pushes, moves} or null when the search gives up (state cap) or the board is unsolvable.
function solvePushes(b: Board, maxStates = MAX_STATES): { pushes: number; moves: string } | null {
  const size = b.w * b.h;
  const goal = new Uint8Array(size);
  for (const g of b.goals) goal[g] = 1;
  const live = liveSquares(b);
  const solved = (boxes: number[]): boolean => boxes.every((x) => goal[x]);
  if (b.boxes.some((x) => !live[x])) return null;
  const key = (boxes: number[], low: number): string => boxes.join(',') + '|' + low;
  const boxesList: number[][] = [b.boxes.slice()];
  const playerList: number[] = [b.player];
  const parent: number[] = [-1];
  const index = new Map<string, number>();
  const occ0 = new Uint8Array(size);
  for (const x of b.boxes) occ0[x] = 1;
  index.set(key(b.boxes, reach(b, occ0, b.player).low), 0);
  if (solved(b.boxes)) return { pushes: 0, moves: '' };
  let found = -1;
  for (let head = 0; found < 0 && head < boxesList.length; head++) {
    const boxes = boxesList[head]!;
    const occ = new Uint8Array(size);
    for (const x of boxes) occ[x] = 1;
    const { seen } = reach(b, occ, playerList[head]!);
    for (let bi = 0; bi < boxes.length && found < 0; bi++) {
      const box = boxes[bi]!;
      for (const [dx, dy] of DIRS) {
        const d = dy * b.w + dx;
        const t = box + d;
        if (!seen[box - d] || b.wall[t] || occ[t] || !live[t]) continue;
        occ[box] = 0; occ[t] = 1;
        const isFrozen = frozen(b, occ, goal, t);
        let k = '';
        let next: number[] = [];
        if (!isFrozen) {
          next = boxes.slice();
          next[bi] = t;
          next.sort((x, y) => x - y);
          k = key(next, reach(b, occ, box).low);
        }
        occ[t] = 0; occ[box] = 1;
        if (isFrozen || index.has(k)) continue;
        if (boxesList.length >= maxStates) return null;
        index.set(k, boxesList.length);
        boxesList.push(next);
        playerList.push(box);
        parent.push(head);
        if (solved(next)) { found = boxesList.length - 1; break; }
      }
    }
  }
  if (found < 0) return null;
  const path: number[] = [];
  for (let s = found; s > 0; s = parent[s]!) path.push(s);
  path.reverse();
  let moves = '';
  let player = b.player;
  let boxes = b.boxes.slice();
  for (const s of path) {
    const next = boxesList[s]!;
    const from = boxes.find((x) => !next.includes(x))!;
    const to = next.find((x) => !boxes.includes(x))!;
    const d = to - from;
    const dir = DIRS.find(([dx, dy]) => dy * b.w + dx === d)!;
    const occ = new Uint8Array(size);
    for (const x of boxes) occ[x] = 1;
    const walk = walkTo(b, occ, player, from - d);
    if (walk === null) return null;
    moves += walk + dir[3];
    player = from;
    boxes = next;
  }
  return { pushes: path.length, moves };
}

// The level's rooms: cut the player's row (the hallway) out of the floor wherever a box
// there reaches no goal; each remaining part holding a box is a room. Null when the level
// is no set of rooms (a box starts in the hallway, a goal is cut off, or a part's boxes
// and goals do not match).
function roomsOf(b: Board): { squares: number[]; boxes: number[]; goals: number[]; done: boolean }[] | null {
  const live = liveSquares(b);
  const row = Math.floor(b.player / b.w);
  const cut = new Uint8Array(b.w * b.h);
  for (let i = row * b.w; i < (row + 1) * b.w; i++) if (!b.wall[i] && !live[i]) cut[i] = 1;
  if (b.boxes.some((x) => cut[x])) return null;
  const part = new Int32Array(b.w * b.h).fill(-1);
  const rooms: { squares: number[]; boxes: number[]; goals: number[]; done: boolean }[] = [];
  for (let s = 0; s < b.w * b.h; s++) {
    if (b.wall[s] || cut[s] || part[s] >= 0) continue;
    const squares = [s];
    part[s] = rooms.length;
    for (let i = 0; i < squares.length; i++) {
      for (const [dx, dy] of DIRS) {
        const q = squares[i]! + dy * b.w + dx;
        if (!b.wall[q] && !cut[q] && part[q] < 0) { part[q] = rooms.length; squares.push(q); }
      }
    }
    rooms.push({ squares, boxes: [], goals: [], done: false });
  }
  for (const x of b.boxes) rooms[part[x]!]!.boxes.push(x);
  for (const g of b.goals) if (part[g]! >= 0) rooms[part[g]!]!.goals.push(g);
  if (b.goals.some((g) => part[g]! < 0)) return null;
  if (rooms.some((r) => r.boxes.length !== r.goals.length)) return null;
  return rooms.filter((r) => r.boxes.length > 0);
}

// Solve room by room: each room's push-optimal solution in turn, the other rooms' boxes
// (on their goals once done) standing as walls, the player walking on from where the last
// room left it. Falls back to solving the whole level at once when it is no set of rooms.
function solveLevel(text: string): string {
  const level = parse(text);
  const rooms = roomsOf(level);
  if (rooms === null) {
    const whole = solvePushes(level);
    return whole === null ? '' : whole.moves;
  }
  let player = level.player;
  let moves = '';
  for (const room of rooms) {
    const wall = level.wall.slice();
    for (const other of rooms) {
      if (other === room) continue;
      for (const x of other.done ? other.goals : other.boxes) wall[x] = 1;
    }
    const sub: Board = {
      w: level.w, h: level.h, wall,
      goals: room.goals.slice().sort((a, b) => a - b),
      boxes: room.boxes.slice().sort((a, b) => a - b),
      player,
    };
    const solved = solvePushes(sub);
    if (solved === null) return '';
    moves += solved.moves;
    for (const ch of solved.moves.toLowerCase())
      player += ch === 'u' ? -level.w : ch === 'd' ? level.w : ch === 'l' ? -1 : 1;
    room.done = true;
  }
  return moves;
}

for (const id of readdirSync(I).sort()) {
  const moves = solveLevel(readFileSync(join(I, id, 'level.txt'), 'utf8'));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'solution.txt'), `${moves}\n`);
}

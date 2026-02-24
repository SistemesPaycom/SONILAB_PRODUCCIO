// utils/LectorDeGuions/hitTest.ts
import type { Stroke } from '../../types/LectorDeGuions/annotation';

function distSq(p1: {x:number, y:number}, p2: {x:number, y:number}) {
    return (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
}

function distToSegmentSq(p: {x:number, y:number}, v: {x:number, y:number}, w: {x:number, y:number}) {
    const l2 = distSq(v, w);
    if (l2 === 0) return distSq(p, v);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return distSq(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
}

export function hitStrokeId(x: number, y: number, strokes: Stroke[], radius: number, zoom: number): string | null {
    const cursor = { x, y };

    for (const stroke of strokes) {
        if (stroke.points.length < 2) continue;
        // Convert screen-space radius to canvas-space and add half stroke width
        const effectiveRadius = (radius / zoom) + (stroke.width / 2);
        const radiusSq = effectiveRadius ** 2;

        for (let i = 0; i < stroke.points.length - 1; i++) {
            const p1 = stroke.points[i];
            const p2 = stroke.points[i+1];
            if (distToSegmentSq(cursor, p1, p2) < radiusSq) {
                return stroke.id;
            }
        }
    }
    return null;
}

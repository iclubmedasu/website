"use client";

import { useEffect, useRef, type PointerEvent } from "react";

// Must stay in sync with rubiks-cube.css (--cubie and --cube).
const CUBIE = 56;
const SPACING = CUBIE; // flush cubies; --cube = 3 * SPACING = 168px
const AXES = ["X", "Y", "Z"] as const;

type FaceKey = "front" | "back" | "right" | "left" | "top" | "bottom";

const FACE_COLORS: Record<FaceKey, string> = {
    front: "purple900",
    back: "purple800",
    right: "purple700",
    left: "purple600",
    top: "purple500",
    bottom: "white",
};

const FACE_ORDER: FaceKey[] = ["front", "back", "right", "left", "top", "bottom"];

type Vec3 = [number, number, number];

interface CubieData {
    el: HTMLDivElement | null;
    pos: Vec3;
    orientation: string;
}

function createCubies(): CubieData[] {
    const cubies: CubieData[] = [];
    for (let x = -1; x <= 1; x += 1) {
        for (let y = -1; y <= 1; y += 1) {
            for (let z = -1; z <= 1; z += 1) {
                cubies.push({ el: null, pos: [x, y, z], orientation: "" });
            }
        }
    }
    return cubies;
}

function baseTransform(c: CubieData): string {
    return `translate3d(${c.pos[0] * SPACING}px, ${c.pos[1] * SPACING}px, ${c.pos[2] * SPACING}px) ${c.orientation}`;
}

// 90deg rotation of an integer position vector about a CSS axis.
function rotateVec(pos: Vec3, axisIndex: number, dir: number): Vec3 {
    const [x, y, z] = pos;
    if (axisIndex === 0) {
        return dir > 0 ? [x, -z, y] : [x, z, -y];
    }
    if (axisIndex === 1) {
        return dir > 0 ? [z, y, -x] : [-z, y, x];
    }
    return dir > 0 ? [-y, x, z] : [y, -x, z];
}

function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function RubiksCube() {
    const wrapRef = useRef<HTMLDivElement>(null);
    const cubiesRef = useRef<CubieData[]>(createCubies());

    const rotXRef = useRef(-24);
    const rotYRef = useRef(-32);
    const isDraggingRef = useRef(false);
    const startXRef = useRef(0);
    const startYRef = useRef(0);

    const spinFrameRef = useRef<number | null>(null);
    const turnFrameRef = useRef<number | null>(null);
    const turnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSpinRef = useRef(0);

    useEffect(() => {
        const cubies = cubiesRef.current;
        cubies.forEach((c) => {
            if (c.el) c.el.style.transform = baseTransform(c);
        });

        const applyWrap = () => {
            if (wrapRef.current) {
                wrapRef.current.style.transform = `rotateX(${rotXRef.current}deg) rotateY(${rotYRef.current}deg)`;
            }
        };
        applyWrap();

        const prefersReducedMotion =
            typeof window !== "undefined" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        // Whole-cube spin (shared source of truth with drag, so no snapping).
        const spin = (now: number) => {
            const delta = lastSpinRef.current ? now - lastSpinRef.current : 0;
            lastSpinRef.current = now;
            if (!isDraggingRef.current && !prefersReducedMotion) {
                rotYRef.current += delta * 0.018;
            }
            applyWrap();
            spinFrameRef.current = requestAnimationFrame(spin);
        };
        spinFrameRef.current = requestAnimationFrame(spin);

        if (prefersReducedMotion) {
            return () => {
                if (spinFrameRef.current != null) cancelAnimationFrame(spinFrameRef.current);
            };
        }

        // Continuous self-shuffle via animated layer turns.
        const TURN_DURATION = 440;
        const PAUSE = 260;

        const runTurn = () => {
            const axisIndex = Math.floor(Math.random() * 3);
            const layer = Math.floor(Math.random() * 3) - 1;
            const dir = Math.random() < 0.5 ? 1 : -1;
            const axis = AXES[axisIndex];
            const affected = cubies.filter((c) => c.pos[axisIndex] === layer);
            const targetAngle = dir * 90;
            const start = performance.now();

            const animate = (now: number) => {
                const progress = Math.min((now - start) / TURN_DURATION, 1);
                const angle = targetAngle * easeInOutCubic(progress);
                for (const c of affected) {
                    if (c.el) {
                        c.el.style.transform = `rotate${axis}(${angle}deg) ${baseTransform(c)}`;
                    }
                }

                if (progress < 1) {
                    turnFrameRef.current = requestAnimationFrame(animate);
                    return;
                }

                // Commit: prepend the turn to orientation, rotate logical position.
                for (const c of affected) {
                    c.orientation = `rotate${axis}(${targetAngle}deg) ${c.orientation}`;
                    c.pos = rotateVec(c.pos, axisIndex, dir);
                    if (c.el) c.el.style.transform = baseTransform(c);
                }

                turnTimeoutRef.current = setTimeout(runTurn, PAUSE);
            };

            turnFrameRef.current = requestAnimationFrame(animate);
        };

        turnTimeoutRef.current = setTimeout(runTurn, PAUSE);

        return () => {
            if (spinFrameRef.current != null) cancelAnimationFrame(spinFrameRef.current);
            if (turnFrameRef.current != null) cancelAnimationFrame(turnFrameRef.current);
            if (turnTimeoutRef.current != null) clearTimeout(turnTimeoutRef.current);
        };
    }, []);

    const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
        isDraggingRef.current = true;
        startXRef.current = event.clientX;
        startYRef.current = event.clientY;
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.classList.add("rubiks-cube-wrap--dragging");
    };

    const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
        if (!isDraggingRef.current) return;
        const dx = event.clientX - startXRef.current;
        const dy = event.clientY - startYRef.current;
        rotYRef.current += dx * 0.4;
        rotXRef.current = Math.max(-85, Math.min(85, rotXRef.current - dy * 0.4));
        startXRef.current = event.clientX;
        startYRef.current = event.clientY;
    };

    const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        event.currentTarget.releasePointerCapture(event.pointerId);
        event.currentTarget.classList.remove("rubiks-cube-wrap--dragging");
    };

    return (
        <div className="rubiks-scene" aria-hidden="true">
            <div className="rubiks-stage">
                <div
                    ref={wrapRef}
                    className="rubiks-cube-wrap"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                >
                    {cubiesRef.current.map((_, index) => (
                        <div
                            key={index}
                            className="rubiks-cubie"
                            ref={(el) => {
                                cubiesRef.current[index].el = el;
                            }}
                        >
                            {FACE_ORDER.map((face) => (
                                <div
                                    key={face}
                                    className={`rubiks-sticker rubiks-sticker--${face} rubiks-cell--${FACE_COLORS[face]}`}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

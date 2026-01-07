import React, { useEffect, useRef } from 'react';

const AnimatedWaveform = ({ isActive = false, intensity = 1 }) => {
    const svgRef = useRef(null);
    const animationFrameRef = useRef(null);
    const phaseRef = useRef(0);

    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;

        const path1 = svg.querySelector('#wave-path-1');
        const path2 = svg.querySelector('#wave-path-2');

        if (!path1 || !path2) return;

        let currentIntensity = isActive ? intensity : 0.3;
        const targetIntensity = isActive ? intensity : 0.3;
        const speed = isActive ? 0.05 : 0.02;

        const animate = () => {
            // Smooth intensity transition
            currentIntensity += (targetIntensity - currentIntensity) * 0.1;

            phaseRef.current += speed;

            // Generate animated wave path 1
            const amplitude1 = 50 * currentIntensity;
            const frequency1 = 0.003;
            let d1 = 'M0,200 ';

            for (let x = 0; x <= 1440; x += 60) {
                const y = 200 +
                    Math.sin(x * frequency1 + phaseRef.current) * amplitude1 +
                    Math.sin(x * frequency1 * 2 + phaseRef.current * 1.5) * (amplitude1 * 0.3);
                d1 += `C${x},${y} ${x + 30},${y} ${x + 60},${y} `;
            }

            // Generate animated wave path 2
            const amplitude2 = 30 * currentIntensity;
            const frequency2 = 0.004;
            let d2 = 'M0,200 ';

            for (let x = 0; x <= 1440; x += 40) {
                const y = 200 +
                    Math.sin(x * frequency2 + phaseRef.current * 0.8) * amplitude2 +
                    Math.sin(x * frequency2 * 1.5 + phaseRef.current) * (amplitude2 * 0.4);
                d2 += `C${x},${y} ${x + 20},${y} ${x + 40},${y} `;
            }

            path1.setAttribute('d', d1);
            path2.setAttribute('d', d2);

            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isActive, intensity]);

    return (
        <svg
            ref={svgRef}
            className="absolute w-full h-full opacity-30"
            preserveAspectRatio="none"
            viewBox="0 0 1440 400"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                id="wave-path-1"
                d="M0,200 C180,200 180,150 360,200 C540,250 540,150 720,200 C900,250 900,100 1080,200 C1260,300 1260,200 1440,200"
                fill="none"
                stroke="#36e27b"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
            />
            <path
                id="wave-path-2"
                d="M0,200 C120,200 120,180 240,200 C360,220 360,180 480,200 C600,220 600,150 720,200 C840,250 840,180 960,200 C1080,220 1080,200 1200,200 L1440,200"
                fill="none"
                stroke="#36e27b"
                strokeOpacity="0.5"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
};

export default AnimatedWaveform;

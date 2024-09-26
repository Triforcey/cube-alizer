// Variables to hold the original cube data and settings
let originalSampledPoints = [];
let edges = [];
let corners = [];
let focalLength = 1;
let angleOfView = 90; // default AOV in degrees
let rpmY = 10; // default rpm for y-axis
let rpmZ = 0;  // default rpm for z-axis
let animationFrameId;

// Variables for scaling and centering
let scaleX, scaleY, xOffset, yOffset;

// Variable for rotation center
let rotationCenter = 'cubeCenter'; // default to cube center

// Cube center coordinates
let cubeCenter = { x: 0, y: 0, z: 0 };

// Variables for oscillation amplitudes
let oscAmpX = 0; // amplitude of oscillation along x-axis
let oscAmpY = 0; // amplitude of oscillation along y-axis
let oscAmpZ = 0; // amplitude of oscillation along z-axis

// Variables for projection equations
let projEqX, projEqY; // evaluatex functions for projection equations

function degToRad(degrees) {
    return degrees * (Math.PI / 180);
}

// Function to rotate points around the y-axis
function rotateY(point, angle) {
    const sinAngle = Math.sin(angle);
    const cosAngle = Math.cos(angle);
    return {
        x: point.x * cosAngle + point.z * sinAngle,
        y: point.y,
        z: -point.x * sinAngle + point.z * cosAngle
    };
}

// Function to rotate points around the z-axis
function rotateZ(point, angle) {
    const sinAngle = Math.sin(angle);
    const cosAngle = Math.cos(angle);
    return {
        x: point.x * cosAngle - point.y * sinAngle,
        y: point.x * sinAngle + point.y * cosAngle,
        z: point.z
    };
}

// Function to apply rotations around both axes
function rotate(point, angleY, angleZ) {
    let rotatedPoint = point;

    const centerX = rotationCenter === 'cubeCenter' ? cubeCenter.x : 0;
    const centerY = rotationCenter === 'cubeCenter' ? cubeCenter.y : 0;
    const centerZ = rotationCenter === 'cubeCenter' ? cubeCenter.z : 0;

    // Translate point to rotation center
    rotatedPoint = {
        x: rotatedPoint.x - centerX,
        y: rotatedPoint.y - centerY,
        z: rotatedPoint.z - centerZ
    };

    // Apply rotations
    rotatedPoint = rotateY(rotatedPoint, angleY);
    rotatedPoint = rotateZ(rotatedPoint, angleZ);

    // Translate point back
    rotatedPoint = {
        x: rotatedPoint.x + centerX,
        y: rotatedPoint.y + centerY,
        z: rotatedPoint.z + centerZ
    };

    return rotatedPoint;
}

function renderPoints() {
    // Get inputs from the DOM
    const x1 = parseFloat(document.getElementById('x1').value);
    const y1 = parseFloat(document.getElementById('y1').value);
    const z1 = parseFloat(document.getElementById('z1').value);

    const x2 = parseFloat(document.getElementById('x2').value);
    const y2 = parseFloat(document.getElementById('y2').value);
    const z2 = parseFloat(document.getElementById('z2').value);

    const N = parseInt(document.getElementById('sampleRate').value);
    angleOfView = parseFloat(document.getElementById('angleOfView').value);
    rpmY = parseFloat(document.getElementById('rpmSliderY').value);
    rpmZ = parseFloat(document.getElementById('rpmSliderZ').value);
    rotationCenter = document.getElementById('rotationCenter').value;

    // Get oscillation amplitudes from sliders
    oscAmpX = parseFloat(document.getElementById('oscillationAmpX').value);
    oscAmpY = parseFloat(document.getElementById('oscillationAmpY').value);
    oscAmpZ = parseFloat(document.getElementById('oscillationAmpZ').value);

    // Validate inputs
    if (isNaN(x1) || isNaN(y1) || isNaN(z1) ||
        isNaN(x2) || isNaN(y2) || isNaN(z2) || isNaN(N) || N <= 1 ||
        isNaN(focalLength) || isNaN(angleOfView)) {
        alert("Invalid input. Please enter numerical values and ensure the sample rate is greater than 1.");
        return;
    }

    // Stop any existing animation
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }

    // Parse projection equations
    try {
        const latexEqX = projEqXField.latex();
        const latexEqY = projEqYField.latex();

        // Compile equations using evaluatex
        projEqX = evaluatex(latexEqX, { latex: true });
        projEqY = evaluatex(latexEqY, { latex: true });
    } catch (error) {
        alert("Error parsing projection equations: " + error.message);
        return;
    }

    // Determine min and max for x, y, z
    const xMin = Math.min(x1, x2);
    const xMax = Math.max(x1, x2);
    const yMin = Math.min(y1, y2);
    const yMax = Math.max(y1, y2);
    const zMin = Math.min(z1, z2);
    const zMax = Math.max(z1, z2);

    // Calculate cube center
    cubeCenter = {
        x: (xMin + xMax) / 2,
        y: (yMin + yMax) / 2,
        z: (zMin + zMax) / 2
    };

    // Generate the 8 corner points
    corners = [
        { x: xMin, y: yMin, z: zMin },
        { x: xMin, y: yMin, z: zMax },
        { x: xMin, y: yMax, z: zMin },
        { x: xMin, y: yMax, z: zMax },
        { x: xMax, y: yMin, z: zMin },
        { x: xMax, y: yMin, z: zMax },
        { x: xMax, y: yMax, z: zMin },
        { x: xMax, y: yMax, z: zMax }
    ];

    // Define the 12 edges as pairs of indices into the corners array
    edges = [
        [0, 1], [0, 2], [0, 4],
        [1, 3], [1, 5], [2, 3],
        [2, 6], [3, 7], [4, 5],
        [4, 6], [5, 7], [6, 7]
    ];

    // For each edge, generate N points and collect unique points
    let sampledPointsMap = new Map();
    for (let i = 0; i < edges.length; i++) {
        const [startIndex, endIndex] = edges[i];
        const startPoint = corners[startIndex];
        const endPoint = corners[endIndex];

        for (let j = 0; j < N; j++) {
            const t = j / (N - 1); // t ranges from 0 to 1
            const x = startPoint.x + t * (endPoint.x - startPoint.x);
            const y = startPoint.y + t * (endPoint.y - startPoint.y);
            const z = startPoint.z + t * (endPoint.z - startPoint.z);

            const point = { x, y, z };
            const key = `${x},${y},${z}`;

            if (!sampledPointsMap.has(key)) {
                sampledPointsMap.set(key, point);
            }
        }
    }

    // Convert the Map to an array of points
    originalSampledPoints = Array.from(sampledPointsMap.values());

    // Calculate initial scaling and centering using AOV and focal length
    calculateScalingAndCentering();

    // Start the animation loop
    startTime = null;
    animate(document.timeline.currentTime);
}

let startTime = null;

function calculateScalingAndCentering() {
    // Use AOV and focal length to calculate the image plane boundaries
    const canvas = document.getElementById('canvas');
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Convert AOV from degrees to radians
    const aovRadians = degToRad(angleOfView);

    // Calculate the half-dimensions of the image plane
    const halfWidth = focalLength * Math.tan(aovRadians / 2);
    const halfHeight = halfWidth * (canvasHeight / canvasWidth); // Maintain aspect ratio

    // Store scaling factors
    scaleX = (canvasWidth / (2 * halfWidth));
    scaleY = (canvasHeight / (2 * halfHeight));

    // Centering offsets
    xOffset = canvasWidth / 2;
    yOffset = canvasHeight / 2;
}

function animate(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime; // in milliseconds
    const timeInSeconds = elapsed / 1000;

    // Calculate the rotation angles based on RPM
    const angleY = ((rpmY * 2 * Math.PI) / 60000) * elapsed; // angle in radians
    const angleZ = ((rpmZ * 2 * Math.PI) / 60000) * elapsed; // angle in radians

    // Calculate oscillation offsets
    const frequency = 0.5; // frequency in Hz
    const offsetX = oscAmpX * Math.sin(2 * Math.PI * frequency * timeInSeconds);
    const offsetY = oscAmpY * Math.sin(2 * Math.PI * frequency * timeInSeconds);
    const offsetZ = oscAmpZ * Math.sin(2 * Math.PI * frequency * timeInSeconds);

    // Rotate and transform points
    const rotatedPoints = originalSampledPoints.map(point => {
        // Apply oscillation offsets
        const shiftedPoint = {
            x: point.x + offsetX,
            y: point.y + offsetY,
            z: point.z + offsetZ
        };
        return rotate(shiftedPoint, angleY, angleZ);
    });

    // Project points onto the image plane using user-defined equations
    const transformedPoints = rotatedPoints.map(({ x, y, z }) => {
        const variables = { x, y, z };
        let projectedX = 0;
        let projectedY = 0;
        try {
            projectedX = projEqX(variables);
            projectedY = projEqY(variables);
        } catch (error) {
            console.error("Error evaluating projection equations:", error);
            projectedX = 0;
            projectedY = 0;
        }
        return { x: projectedX, y: projectedY };
    });

    // Prepare to render on canvas
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw edges
    ctx.strokeStyle = 'red';
    for (let i = 0; i < edges.length; i++) {
        const [startIndex, endIndex] = edges[i];

        let startPoint3D = corners[startIndex];
        let endPoint3D = corners[endIndex];

        // Apply oscillation offsets
        startPoint3D = {
            x: startPoint3D.x + offsetX,
            y: startPoint3D.y + offsetY,
            z: startPoint3D.z + offsetZ
        };
        endPoint3D = {
            x: endPoint3D.x + offsetX,
            y: endPoint3D.y + offsetY,
            z: endPoint3D.z + offsetZ
        };

        // Apply rotation
        startPoint3D = rotate(startPoint3D, angleY, angleZ);
        endPoint3D = rotate(endPoint3D, angleY, angleZ);

        // Project onto image plane using user-defined equations
        const variablesStart = { x: startPoint3D.x, y: startPoint3D.y, z: startPoint3D.z };
        const variablesEnd = { x: endPoint3D.x, y: endPoint3D.y, z: endPoint3D.z };

        let x1 = 0, y1 = 0, x2 = 0, y2 = 0;

        try {
            x1 = projEqX(variablesStart) * scaleX + xOffset;
            y1 = canvas.height - (projEqY(variablesStart) * scaleY + yOffset);
            x2 = projEqX(variablesEnd) * scaleX + xOffset;
            y2 = canvas.height - (projEqY(variablesEnd) * scaleY + yOffset);
        } catch (error) {
            console.error("Error evaluating projection equations:", error);
            continue; // Skip drawing this edge
        }

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    // Draw points
    ctx.fillStyle = 'blue';
    transformedPoints.forEach(point => {
        const x = point.x * scaleX + xOffset;
        const y = canvas.height - (point.y * scaleY + yOffset);
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fill();
    });

    // Continue the animation
    animationFrameId = requestAnimationFrame(animate);
}

// Initialize MathQuill for projection equation inputs
const MQ = MathQuill.getInterface(2); // MathQuill.js version 2 interface

// Default projection equations
const defaultProjEqX = "\\frac{x}{y}";
const defaultProjEqY = "\\frac{z}{y}";

const projEqXSpan = document.getElementById('projEqX');
const projEqYSpan = document.getElementById('projEqY');

const projEqXField = MQ.MathField(projEqXSpan, {
    spaceBehavesLikeTab: true,
    handlers: {
        edit: function() {
            // Equation has been edited
        }
    }
});
const projEqYField = MQ.MathField(projEqYSpan, {
    spaceBehavesLikeTab: true,
    handlers: {
        edit: function() {
            // Equation has been edited
        }
    }
});

// Set default equations
projEqXField.latex(defaultProjEqX);
projEqYField.latex(defaultProjEqY);

// Update RPM display and variables when sliders change
document.getElementById('rpmSliderY').addEventListener('input', function () {
    rpmY = parseFloat(this.value);
    document.getElementById('rpmValueY').textContent = rpmY;
});

document.getElementById('rpmSliderZ').addEventListener('input', function () {
    rpmZ = parseFloat(this.value);
    document.getElementById('rpmValueZ').textContent = rpmZ;
});

// Add event listeners for the oscillation sliders
document.getElementById('oscillationAmpX').addEventListener('input', function () {
    oscAmpX = parseFloat(this.value);
    document.getElementById('oscillationAmpXValue').textContent = oscAmpX.toFixed(1);
});

document.getElementById('oscillationAmpY').addEventListener('input', function () {
    oscAmpY = parseFloat(this.value);
    document.getElementById('oscillationAmpYValue').textContent = oscAmpY.toFixed(1);
});

document.getElementById('oscillationAmpZ').addEventListener('input', function () {
    oscAmpZ = parseFloat(this.value);
    document.getElementById('oscillationAmpZValue').textContent = oscAmpZ.toFixed(1);
});

document.getElementById('renderButton').addEventListener('click', renderPoints);

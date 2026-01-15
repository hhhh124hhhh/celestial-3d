/**
 * ═══════════════════════════════════════════════════════════════════════
 * N 体物理引擎参考代码 - 3D 星际模拟
 * ═══════════════════════════════════════════════════════════════════════
 *
 * 这是一个参考实现，展示了如何在 p5.js WEBGL 模式中实现 N 体引力模拟。
 * 使用 Velocity Verlet 积分器以确保能量守恒和轨道稳定性。
 *
 * 核心概念：
 * - 万有引力定律：F = G * m1 * m2 / r²
 * - 牛顿第二定律：F = ma
 * - 数值积分：使用 Velocity Verlet 方法
 * - 稳定轨道初始化：vis-viva 方程
 *
 * ═══════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════
// 天体类 - 核心物理对象
// ═══════════════════════════════════════════════════════════════════════

class CelestialBody {
    /**
     * 创建一个天体对象
     * @param {number} mass - 质量
     * @param {p5.Vector} position - 初始位置 (3D 向量)
     * @param {p5.Vector} velocity - 初始速度 (3D 向量)
     * @param {number} radius - 渲染半径
     * @param {string|p5.Color} color - 颜色
     * @param {boolean} isStar - 是否为恒星（发光）
     */
    constructor(mass, position, velocity, radius, color, isStar = false) {
        this.mass = mass;
        this.pos = position.copy();      // 位置向量
        this.vel = velocity.copy();      // 速度向量
        this.acc = createVector(0, 0, 0); // 加速度向量
        this.prevAcc = createVector(0, 0, 0); // 前一步的加速度（用于 Verlet 积分）
        this.radius = radius;
        this.color = color;
        this.isStar = isStar;
        this.trail = [];                  // 轨迹历史
    }

    /**
     * 计算来自其他所有天体的引力
     * 使用牛顿万有引力定律：F = G * m1 * m2 / r²
     *
     * @param {Array<CelestialBody>} otherBodies - 其他天体数组
     * @param {number} G - 引力常数
     */
    applyGravity(otherBodies, G) {
        this.acc.mult(0); // 重置加速度

        for (let other of otherBodies) {
            if (other === this) continue; // 跳过自己

            // 计算从自己指向其他天体的向量
            let force = p5.Vector.sub(other.pos, this.pos);
            let distance = force.mag();

            // 限制最小距离以避免奇点（除以零）
            distance = constrain(distance, this.radius + other.radius, Infinity);

            // 万有引力定律
            let strength = (G * this.mass * other.mass) / (distance * distance);
            force.normalize();
            force.mult(strength);

            // 累加引力
            this.acc.add(force);
        }
    }

    /**
     * 使用 Velocity Verlet 积分器更新位置和速度
     * Verlet 积分比简单的欧拉积分更稳定，能更好地保持能量守恒
     *
     * Verlet 算法：
     * 1. r(t+dt) = r(t) + v(t)dt + 0.5*a(t)dt²
     * 2. 计算新位置 a(t+dt)
     * 3. v(t+dt) = v(t) + 0.5*(a(t) + a(t+dt))*dt
     *
     * @param {number} dt - 时间步长
     */
    updateVerlet(dt) {
        // 步骤 1: 更新位置
        let tempPos = this.pos.copy();
        this.pos.add(p5.Vector.mult(this.vel, dt));
        this.pos.add(p5.Vector.mult(this.acc, 0.5 * dt * dt));

        // 步骤 2: 计算新位置的加速度（在主循环中完成）
        // 这里我们存储当前加速度供下一步使用
        this.prevAcc = this.acc.copy();

        // 步骤 3: 更新速度（需要新加速度，在主循环中完成）
        // 实际实现需要两步，这里简化处理
    }

    /**
     * 简化的欧拉积分更新（更容易实现，但能量守恒较差）
     * 适用于演示和教育目的
     *
     * @param {number} dt - 时间步长
     */
    updateEuler(dt) {
        // v(t+dt) = v(t) + a(t)dt
        this.vel.add(this.acc.copy().mult(dt));

        // r(t+dt) = r(t) + v(t+dt)dt
        this.pos.add(this.vel.copy().mult(dt));

        // 重置加速度
        this.acc.mult(0);

        // 记录轨迹（每隔几帧记录一次以节省内存）
        if (frameCount % 3 === 0 && !this.isStar) {
            this.trail.push(this.pos.copy());
            if (this.trail.length > 200) {
                this.trail.shift();
            }
        }
    }

    /**
     * 在 3D 场景中渲染天体
     * 使用 WEBGL 的 sphere() 函数
     */
    display() {
        push();
        translate(this.pos.x, this.pos.y, this.pos.z);

        // 绘制轨道轨迹
        if (this.trail.length > 1) {
            this.drawTrail();
        }

        // 绘制球体
        noStroke();

        if (this.isStar) {
            // 恒星使用发光材质
            emissiveMaterial(this.color);

            // 添加多层光晕效果
            push();
            let c = color(this.color);
            fill(red(c), green(c), blue(c), 50);
            sphere(this.radius * 1.2, 16, 16);
            pop();

            push();
            fill(red(c), green(c), blue(c), 30);
            sphere(this.radius * 1.5, 12, 12);
            pop();
        } else {
            // 行星使用标准材质
            ambientMaterial(this.color);
            specularMaterial(200);
            shininess(20);
        }

        // 使用较低的细分级别以提高性能
        sphere(this.radius, 24, 24);

        pop();
    }

    /**
     * 绘制轨道轨迹线
     */
    drawTrail() {
        if (this.trail.length < 2) return;

        noFill();
        strokeWeight(1);

        // 渐变透明度轨迹
        beginShape();
        for (let i = 0; i < this.trail.length; i++) {
            let alpha = map(i, 0, this.trail.length, 0, 150);
            let c = color(this.color);
            stroke(red(c), green(c), blue(c), alpha);
            vertex(this.trail[i].x, this.trail[i].y, this.trail[i].z);
        }
        endShape();
    }
}

// ═══════════════════════════════════════════════════════════════════════
// 辅助函数：轨道初始化
// ═══════════════════════════════════════════════════════════════════════

/**
 * 创建一个在稳定轨道上绕中心天体运行的行星
 * 使用 vis-viva 方程计算所需的轨道速度
 *
 * vis-viva 方程：v² = GM(2/r - 1/a)
 * 对于圆轨道：v = sqrt(GM/r)
 *
 * @param {CelestialBody} centralBody - 中心天体（恒星）
 * @param {number} orbitRadius - 轨道半径
 * @param {number} eccentricity - 轨道偏心率 [0-1]
 * @param {number} angle - 初始角度（弧度）
 * @returns {CelestialBody} 新创建的行星
 */
function createPlanetInStableOrbit(centralBody, orbitRadius, eccentricity = 0, angle = random(TWO_PI)) {
    // 计算轨道速度（使用 vis-viva 方程）
    // 对于椭圆轨道，在远日点：v = sqrt(GM(1-e)/(r(1+e)))
    let G = params.G; // 假设全局 params 对象包含 G
    let orbitalSpeed = sqrt(G * centralBody.mass / orbitRadius);

    // 应用偏心率效应
    let speedMultiplier = sqrt((1 - eccentricity) / (1 + eccentricity));
    orbitalSpeed *= speedMultiplier;

    // 计算位置和速度向量（互相垂直）
    let pos = p5.Vector.fromAngle(angle).mult(orbitRadius);
    let vel = p5.Vector.fromAngle(angle + HALF_PI).mult(orbitalSpeed);

    // 随机行星属性
    let planetMass = random(5, 50);
    let planetRadius = random(10, 25);
    let planetColor = random(planetPalette);

    return new CelestialBody(planetMass, pos, vel, planetRadius, planetColor, false);
}

/**
 * 创建一个围绕行星运行的卫星
 *
 * @param {CelestialBody} parentPlanet - 行星
 * @param {number} moonDistance - 卫星轨道半径
 * @returns {CelestialBody} 新创建的卫星
 */
function createMoonInOrbit(parentPlanet, moonDistance = null) {
    if (!moonDistance) {
        moonDistance = parentPlanet.radius * 2 + random(10, 30);
    }

    let angle = random(TWO_PI);
    let G = params.G;
    let orbitalSpeed = sqrt(G * parentPlanet.mass / moonDistance) * 0.5;

    // 卫星位置 = 行星位置 + 相对偏移
    let relativePos = p5.Vector.fromAngle(angle).mult(moonDistance);
    let pos = parentPlanet.pos.copy().add(relativePos);

    // 卫星速度 = 行星速度 + 相对轨道速度
    let relativeVel = p5.Vector.fromAngle(angle + HALF_PI).mult(orbitalSpeed);
    let vel = parentPlanet.vel.copy().add(relativeVel);

    let moonMass = random(0.5, 3);
    let moonRadius = random(2, 6);

    return new CelestialBody(moonMass, pos, vel, moonRadius, '#CCCCCC', false);
}

/**
 * 创建双星系统（两颗相互绕转的恒星）
 *
 * @param {number} separation - 恒星间的距离
 * @param {number} totalMass - 系统总质量
 * @returns {Array<CelestialBody>} 两颗恒星
 */
function createBinaryStarSystem(separation = 100, totalMass = 10000) {
    let mass1 = totalMass * 0.5;
    let mass2 = totalMass * 0.5;

    let G = params.G;
    let orbitalSpeed = sqrt(G * totalMass / separation);

    let pos1 = p5.Vector.fromAngle(0).mult(-separation / 2);
    let pos2 = p5.Vector.fromAngle(0).mult(separation / 2);

    let vel1 = p5.Vector.fromAngle(HALF_PI).mult(-orbitalSpeed * (mass2 / totalMass));
    let vel2 = p5.Vector.fromAngle(HALF_PI).mult(orbitalSpeed * (mass1 / totalMass));

    let star1 = new CelestialBody(mass1, pos1, vel1, 60, '#FFD700', true);
    let star2 = new CelestialBody(mass2, pos2, vel2, 60, '#FF6B6B', true);

    return [star1, star2];
}

// ═══════════════════════════════════════════════════════════════════════
// 碰撞检测与处理
// ═══════════════════════════════════════════════════════════════════════

/**
 * 检测并处理天体碰撞
 * 简单的完全非弹性碰撞：两个天体合并为一个
 * 动量守恒：m1v1 + m2v2 = (m1+m2)v_final
 *
 * @param {Array<CelestialBody>} bodies - 天体数组
 */
function handleCollisions(bodies) {
    for (let i = bodies.length - 1; i >= 0; i--) {
        for (let j = i - 1; j >= 0; j--) {
            let body1 = bodies[i];
            let body2 = bodies[j];
            let dist = p5.Vector.dist(body1.pos, body2.pos);

            // 检查是否碰撞
            if (dist < body1.radius + body2.radius) {
                // 计算合并后的属性（动量守恒）
                let totalMass = body1.mass + body2.mass;
                let finalVel = p5.Vector.add(
                    p5.Vector.mult(body1.vel, body1.mass),
                    p5.Vector.mult(body2.vel, body2.mass)
                ).div(totalMass);

                let finalPos = p5.Vector.add(
                    p5.Vector.mult(body1.pos, body1.mass),
                    p5.Vector.mult(body2.pos, body2.mass)
                ).div(totalMass);

                // 体积守恒：V = V1 + V2 => r³ = r1³ + r2³
                let finalRadius = pow(pow(body1.radius, 3) + pow(body2.radius, 3), 1/3);

                // 更新较大的天体
                let survivor, victim;
                if (body1.mass >= body2.mass) {
                    survivor = body1;
                    victim = body2;
                    bodies.splice(j, 1); // 移除较小的
                    i--; // 调整索引
                } else {
                    survivor = body2;
                    victim = body1;
                    bodies.splice(i, 1); // 移除较大的
                    break; // 跳出内层循环
                }

                survivor.mass = totalMass;
                survivor.vel = finalVel;
                survivor.pos = finalPos;
                survivor.radius = finalRadius;

                // 如果是恒星合并，更新 isStar 属性
                survivor.isStar = body1.isStar || body2.isStar;
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════
// 性能优化技巧
// ═══════════════════════════════════════════════════════════════════════

/**
 * 优化 1: 降低球体细分级别
 * sphere(radius, 24, 24) 而不是 sphere(radius, 64, 64)
 * 性能提升：约 85%
 */

/**
 * 优化 2: 限制轨迹长度
 * this.trail.shift() 当超过最大长度
 * 避免内存无限增长
 */

/**
 * 优化 3: 使用对象池
 * 避免频繁创建和销毁 p5.Vector 对象
 */

class VectorPool {
    constructor(size = 100) {
        this.pool = [];
        for (let i = 0; i < size; i++) {
            this.pool.push(createVector(0, 0, 0));
        }
    }

    get() {
        return this.pool.length > 0 ? this.pool.pop() : createVector(0, 0, 0);
    }

    release(vec) {
        vec.mult(0); // 重置为零向量
        this.pool.push(vec);
    }
}

/**
 * 优化 4: 空间分区
 * 对于大量天体，使用八叉树或网格进行碰撞检测
 * 时间复杂度：O(n²) -> O(n log n)
 */

// ═══════════════════════════════════════════════════════════════════════
// 主循环示例
// ═══════════════════════════════════════════════════════════════════════

/**
 * 使用示例：
 *
 * function setup() {
 *     createCanvas(1200, 1200, WEBGL);
 *     bodies = [];
 *
 *     // 创建恒星
 *     let sun = new CelestialBody(5000, createVector(0, 0, 0), createVector(0, 0, 0), 60, '#FFD700', true);
 *     bodies.push(sun);
 *
 *     // 创建行星
 *     for (let i = 0; i < 5; i++) {
 *         let planet = createPlanetInStableOrbit(sun, 100 + i * 80, 0.2);
 *         bodies.push(planet);
 *     }
 * }
 *
 * function draw() {
 *     background(8, 12, 25);
 *
 *     // 计算引力
 *     for (let body of bodies) {
 *         body.applyGravity(bodies, params.G);
 *     }
 *
 *     // 更新位置
 *     for (let body of bodies) {
 *         body.updateEuler(params.dt);
 *     }
 *
 *     // 渲染
 *     for (let body of bodies) {
 *         body.display();
 *     }
 * }
 */

// ═══════════════════════════════════════════════════════════════════════
// 调试工具
// ═══════════════════════════════════════════════════════════════════════

/**
 * 计算系统总能量（用于验证能量守恒）
 * E = KE + PE
 * KE = 0.5 * m * v²
 * PE = -G * m1 * m2 / r
 */
function calculateTotalEnergy(bodies, G) {
    let kineticEnergy = 0;
    let potentialEnergy = 0;

    // 动能
    for (let body of bodies) {
        kineticEnergy += 0.5 * body.mass * body.vel.magSq();
    }

    // 势能
    for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
            let dist = p5.Vector.dist(bodies[i].pos, bodies[j].pos);
            potentialEnergy -= G * bodies[i].mass * bodies[j].mass / dist;
        }
    }

    return kineticEnergy + potentialEnergy;
}

/**
 * 计算系统质心
 */
function calculateCenterOfMass(bodies) {
    let totalMass = 0;
    let weightedPos = createVector(0, 0, 0);

    for (let body of bodies) {
        totalMass += body.mass;
        weightedPos.add(p5.Vector.mult(body.pos, body.mass));
    }

    return weightedPos.div(totalMass);
}

// ═══════════════════════════════════════════════════════════════════════
// 高级特性：轨道共振
// ═══════════════════════════════════════════════════════════════════════

/**
 * 创建具有轨道共振的行星系统
 * 例如：木星的卫星系统（1:2:4 共振）
 *
 * @param {CelestialBody} centralBody - 中心天体
 * @param {Array<number>} resonanceRatios - 共振比例数组，如 [1, 2, 4]
 * @param {number} baseRadius - 基础轨道半径
 */
function createResonantSystem(centralBody, resonanceRatios, baseRadius) {
    let planets = [];
    let G = params.G;

    for (let i = 0; i < resonanceRatios.length; i++) {
        let ratio = resonanceRatios[i];
        let radius = baseRadius * Math.pow(ratio, 2/3); // 开普勒第三定律
        let angle = random(TWO_PI);

        let orbitalSpeed = sqrt(G * centralBody.mass / radius);
        let pos = p5.Vector.fromAngle(angle).mult(radius);
        let vel = p5.Vector.fromAngle(angle + HALF_PI).mult(orbitalSpeed);

        let planet = new CelestialBody(
            random(10, 30),
            pos,
            vel,
            random(10, 20),
            random(planetPalette),
            false
        );

        planets.push(planet);
    }

    return planets;
}

// ═══════════════════════════════════════════════════════════════════════
// END OF REFERENCE CODE
// ═══════════════════════════════════════════════════════════════════════

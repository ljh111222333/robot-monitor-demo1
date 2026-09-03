import * as THREE from 'three';
import type { URDFJoint, URDFRobot } from 'urdf-loader';
import { loadUrdf } from '@/utils/urdfLoader';
import type { Scene } from './Scene';

//关节配置
export const UR5_JOINT_ORDER = [
	'shoulder_pan_joint',
	'shoulder_lift_joint',
	'elbow_joint',
	'wrist_1_joint',
	'wrist_2_joint',
	'wrist_3_joint',
] as const;

export type UR5JointName = (typeof UR5_JOINT_ORDER)[number];
export type JointTargets = Partial<Record<UR5JointName, number>>;
export interface JointState {
	name: UR5JointName;
	valueRad: number;
	minRad: number;
	maxRad: number;
	maxVelocity: number;
}

export class Robot {
	private readonly scene: Scene;
	private readonly urdfUrl: string;

	private robot: URDFRobot | null = null;

	constructor(scene: Scene, urdfUrl: string) {
		this.scene = scene;
		this.urdfUrl = urdfUrl;
	}

	//加载
	async load() {
		// 加载 URDF 模型
		const robot = await loadUrdf(this.urdfUrl);

		// URDF 使用 Z-up，当前 Three.js 场景按 Y-up 使用。
		// 只旋转整个机器人根节点，不要修改各关节的坐标系。
		robot.rotation.x = -Math.PI / 2;

		this.validateJoints(robot);

		// 设置阴影
		robot.traverse((child) => {
			if (!(child instanceof THREE.Mesh)) {
				return;
			}

			child.castShadow = true;
			child.receiveShadow = false;
		});

		this.scene.add(robot);
		this.robot = robot;
	}

	// 关节校验
	private validateJoints(robot: URDFRobot): void {
		const missingJoints = UR5_JOINT_ORDER.filter((name) => !robot.joints[name]);
		if (missingJoints.length > 0) {
			throw new Error(`URDF 缺少关节: ${missingJoints.join(', ')}`);
		}
	}

	// 控制robot弧度
	setJointRadians(name: UR5JointName, valueRad: number): number {
		const joint = this.requireJoint(name);
		// urdf-loader 会按照 URDF 中的 limit 自动限制 revolute joint。
		joint.setJointValue(valueRad);
		return joint.angle;
	}
	// 控制robot角度
	setJointDegrees(name: UR5JointName, valueDeg: number): number {
		const actualRad = this.setJointRadians(
			name,
			THREE.MathUtils.degToRad(valueDeg),
		);
		return THREE.MathUtils.radToDeg(actualRad);
	}
	// 设置robot位置
	setJointPositions(targets: JointTargets): void {
		for (const name of UR5_JOINT_ORDER) {
			const value = targets[name];
			if (value === undefined) {
				continue;
			}
			this.setJointRadians(name, value);
		}
	}

	// 获取末端坐标系
	getEndEffectorPosition(target = new THREE.Vector3()): {
		[name in string]: THREE.Vector3;
	} {
		const robot = this.requireRobot();
		const endEffector = robot.getFrame('wrist_3_link');
		if (!endEffector) {
			throw new Error('URDF 中不存在末端坐标系 wrist_3_link');
		}
		robot.updateMatrixWorld(true);

		// 获取机器人包围盒位置/大小
		const robotBox = new THREE.Box3().setFromObject(robot);
		const robotBoxCenter = robotBox.getCenter(new THREE.Vector3());
		const robotBoxSize = robotBox.getSize(new THREE.Vector3());
		// console.log('robot position center', {
		// 	robotRoot: robot.position.toArray(),
		// 	visualCenter: robotBoxCenter.toArray(),
		// 	size: robotBoxSize.toArray(),
		// 	controlsTarget: this.scene.controls.target.toArray(),
		// });
		return {
			worldPosition: endEffector.getWorldPosition(target), // 末端坐标系世界位置
			robotBoxCenter, // 机器人包围盒中心
			robotBoxSize, // 机器人包围盒尺寸
		};
	}

	private requireRobot(): URDFRobot {
		if (!this.robot) {
			throw new Error('机械臂尚未加载');
		}
		return this.robot;
	}
	private requireJoint(name: UR5JointName): URDFJoint {
		const joint = this.requireRobot().joints[name];
		if (!joint) {
			throw new Error(`URDF 中不存在关节 ${name}`);
		}
		return joint;
	}

	getModel(): URDFRobot | null {
		return this.robot;
	}
	reset(): void {
		for (const name of UR5_JOINT_ORDER) {
			this.setJointRadians(name, 0);
		}
	}
	dispose(): void {
		if (!this.robot) {
			return;
		}
		this.scene.remove(this.robot);
		this.robot = null;
	}
}

<template>
	<div class="log-panel-btn">
		<div class="log-toggle" @click="extendFlag = !extendFlag">
			<svg
				class="toggle-icon"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
			>
				<!-- 轴承外圈 -->
				<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1" />
				<!-- 轴承内圈 -->
				<circle cx="12" cy="12" r="6" stroke="currentColor" stroke-width="1" />
				<!-- 滚珠 -->
				<circle cx="12" cy="6" r="1.5" fill="currentColor" />
				<circle cx="17.2" cy="8.8" r="1.5" fill="currentColor" />
				<circle cx="17.2" cy="15.2" r="1.5" fill="currentColor" />
				<circle cx="12" cy="18" r="1.5" fill="currentColor" />
				<circle cx="6.8" cy="15.2" r="1.5" fill="currentColor" />
				<circle cx="6.8" cy="8.8" r="1.5" fill="currentColor" />
				<!-- 轴承中心 -->
				<circle cx="12" cy="12" r="2" stroke="currentColor" stroke-width="1" />
			</svg>
		</div>

		<transition name="fade">
			<div v-show="extendFlag" class="log-panel">
				<div class="log-header">
					<div class="log-title">系统日志</div>
					<div class="header-actions">
						<button
							class="action-btn clear-btn"
							title="清空日志"
							@click="logStore.clear()"
						>
							<svg
								viewBox="0 0 24 24"
								fill="currentColor"
								width="16"
								height="16"
							>
								<path
									d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"
								/>
							</svg>
						</button>
						<button
							class="action-btn collapse-btn"
							title="收起"
							@click.stop.prevent="extendFlag = false"
						>
							<svg
								viewBox="0 0 24 24"
								fill="currentColor"
								width="16"
								height="16"
							>
								<rect x="6" y="11" width="12" height="2" rx="1" />
							</svg>
						</button>
					</div>
				</div>

				<div class="log-content">
					<div ref="messageContainer" class="log-messages">
						<div
							v-for="message in messages"
							:key="message.id"
							:class="message.type"
						>
							{{ formatTime(message.timestamp) }}
							{{ message.content }}
						</div>
					</div>
				</div>
			</div>
		</transition>
	</div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { useLogStore } from '@/stores/logStore';
const logStore = useLogStore();
const messages = computed(() => logStore.messages);

const formatTime = (timestamp: number) => {
	return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss');
};

const extendFlag = ref(false);
</script>

<style lang="scss" scoped>
.log-panel-btn {
	position: fixed;
	bottom: 20px;
	left: 20px;
	width: 20px;
	height: 20px;
	background-color: #fff;
	border-radius: 50%;
	cursor: pointer;
	z-index: 1000;
	&:hover {
		background-color: #f0f0f0;
	}

	// 切换按钮（圆环）
	.log-toggle {
		border: 1px solid rgba(0, 0, 0, 0);
		width: 30px;
		height: 30px;
		background: hsla(221.54, 37.14%, 6.86%, 0.85);
		border-radius: 50%;
		cursor: pointer;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow:
			0 2px 8px rgba(0, 0, 0, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);

		&:hover {
			transform: scale(1.1);
			border-color: #4bff96;
			box-shadow: 2px 2px 8px #4bff96;

			.toggle-icon {
				transform: rotate(180deg);
			}
		}

		.toggle-icon {
			width: 20px;
			height: 20px;
			color: rgba(230, 230, 230, 0.9);
			transition: transform 0.3s ease;
		}
	}

	.log-panel {
		position: absolute;
		top: -5px;
		right: -5px;
		transform: translate(100%, -100%);
		transform-origin: left bottom;

		width: 420px;
		height: 300px;
		border: 1px solid rgba(75, 85, 99, 0.3);
		border-radius: 12px;
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.4),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
		display: flex;
		flex-direction: column;
		overflow: hidden;

		// 面板头部
		.log-header {
			padding: 6px 12px;
			border-bottom: 1px solid rgba(75, 85, 99, 0.3);
			display: flex;
			align-items: center;
			justify-content: space-between;
			background: rgba(11, 15, 24, 0.95);

			.log-title {
				font-size: 12px;
				font-weight: 600;
				color: rgba(209, 213, 219, 0.95);
				font-family: 'Microsoft YaHei', '微软雅黑', Arial, sans-serif;
				letter-spacing: 0.025em;
			}

			.header-actions {
				display: flex;
				align-items: center;
				gap: 8px;

				.action-btn {
					width: 24px;
					height: 24px;
					border: none;
					background: rgba(55, 65, 81, 0.6);
					border-radius: 4px;
					color: rgba(209, 213, 219, 0.9);
					cursor: pointer;
					display: flex;
					align-items: center;
					justify-content: center;
					transition: all 0.2s ease;

					&:hover {
						background: rgba(75, 85, 99, 0.8);
						color: rgba(229, 231, 235, 1);
						transform: scale(1.05);
					}

					&.clear-btn:hover {
						background: rgba(239, 68, 68, 0.2);
						color: rgba(239, 68, 68, 0.9);
					}

					&.collapse-btn:hover {
						background: rgba(59, 130, 246, 0.2);
						color: rgba(59, 130, 246, 0.9);
					}
				}
			}
		}

		// 日志内容区域
		.log-content {
			flex: 1;
			padding: 0;
			overflow: hidden;
			display: flex;
			flex-direction: column;
			background: rgba(11, 15, 24, 0.9);

			.log-messages {
				flex: 1;
				overflow-y: auto;
				padding: 12px 16px;
				scroll-behavior: smooth;

				&::-webkit-scrollbar {
					width: 6px;
				}

				&::-webkit-scrollbar-track {
					background: rgba(31, 41, 55, 0.5);
					border-radius: 3px;
				}

				&::-webkit-scrollbar-thumb {
					background: rgba(75, 85, 99, 0.6);
					border-radius: 3px;

					&:hover {
						background: rgba(107, 114, 128, 0.8);
					}
				}

				.log-message {
					display: flex;
					align-items: flex-start;
					margin-bottom: 8px;
					font-family: 'JetBrains Mono', 'Fira Code', monospace;
					font-size: 11px;
					line-height: 1.4;
					word-break: break-all;

					&:last-child {
						margin-bottom: 0;
					}

					.message-time {
						color: rgba(156, 163, 175, 0.8);
						font-size: 10px;
						min-width: 55px;
						margin-right: 8px;
						flex-shrink: 0;
						font-variant-numeric: tabular-nums;
					}

					.message-content {
						flex: 1;
						color: rgba(229, 231, 235, 0.95);

						&.info {
							color: rgb(87, 165, 255, 0.95);
						}
						&.success {
							color: rgba(48, 233, 116, 0.95);
						}
						&.warning {
							color: rgba(251, 191, 36, 0.95);
						}
						&.error {
							color: rgba(239, 68, 68, 0.95);
						}
						&.debug {
							color: rgba(229, 231, 235, 0.85);
						}
					}
				}
			}

			// 空状态
			.log-empty {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				height: 100%;
				color: rgba(156, 163, 175, 0.7);
				font-family: 'JetBrains Mono', 'Fira Code', monospace;
				font-size: 12px;

				.empty-icon {
					width: 32px;
					height: 32px;
					margin-bottom: 8px;
					opacity: 0.6;
				}

				.empty-text {
					text-align: center;
					line-height: 1.5;
				}
			}

			// 回到最新消息按钮
			.scroll-to-bottom-btn {
				position: absolute;
				bottom: 24px;
				right: 12px;
				width: 32px;
				height: 32px;
				background: rgba(60, 101, 167, 0.2);
				border: none;
				border-radius: 50%;
				color: rgba(236, 236, 236, 0.5);
				scale: 1;
				cursor: pointer;
				display: flex;
				align-items: center;
				justify-content: center;
				transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

				&.hidden {
					background: rgba(0, 0, 0, 0);
					scale: 0;
				}
			}
		}
	}
}

.fade-enter-active {
	animation: fadeIn 0.3s ease-in-out;
}

.fade-leave-active {
	animation: fadeOut 0.15s ease-in-out;
}

@keyframes fadeIn {
	from {
		opacity: 0;
		transform: translate(100%, -100%) scale(0);
	}
	to {
		opacity: 1;
		transform: translate(100%, -100%) scale(1);
	}
}

@keyframes fadeOut {
	from {
		opacity: 1;
		transform: translate(100%, -100%) scale(1);
	}
	to {
		opacity: 0;
		transform: translate(100%, -100%) scale(0.8);
	}
}
</style>

<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'

import { mobileSession } from './mobileSession'

onLaunch(() => {
  void mobileSession.restore()
})
</script>

<style>
page {
  min-height: 100%;
  background: #f4f7fb;
  color: #1d2d45;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif;
}

button::after { border: 0; }

.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 32rpx;
}

.eyebrow {
  margin: 0 0 10rpx;
  color: #5b52d9;
  font-size: 24rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.page-title {
  margin: 0;
  font-size: 48rpx;
  font-weight: 800;
  line-height: 1.25;
}

.muted { color: #78879d; }

.card {
  margin-top: 28rpx;
  padding: 30rpx;
  border: 1rpx solid #e0e7f0;
  border-radius: 28rpx;
  background: #ffffff;
  box-shadow: 0 16rpx 50rpx rgba(29, 45, 69, 0.07);
}

.primary-button,
.secondary-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88rpx;
  margin: 0;
  border-radius: 22rpx;
  font-size: 30rpx;
  font-weight: 700;
}

.primary-button { color: #ffffff; background: #5b52d9; }
.secondary-button { color: #314158; background: #edf1f7; }
.primary-button[disabled], .secondary-button[disabled] { opacity: 0.55; }

.status-message {
  margin: 22rpx 0 0;
  padding: 22rpx 24rpx;
  border-radius: 18rpx;
  color: #9b3f35;
  background: #fff0ed;
  font-size: 26rpx;
  line-height: 1.6;
}

.empty-state {
  padding: 72rpx 24rpx;
  color: #78879d;
  text-align: center;
}
</style>

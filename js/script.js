// --- 全局稳定性增强：防止各种不可预见的异常导致应用崩溃 ---
        window.onerror = function(msg, url, line, col, error) {
            console.error('System Error:', msg, 'at', line, ':', col);
            if (msg && msg.toLowerCase().indexOf('script error') > -1) {
                console.warn('跨域脚本错误，请检查资源引用');
            }
            return false;
        };

        // 防止重复初始化的全局锁
        if (window.__EternOS_Initialized__) {
            console.warn('EternOS 已经初始化，跳过重复加载');
        } else {
            window.__EternOS_Initialized__ = true;
            
            // 将全局常量移至此处，确保 fetchLocalCityForClock 等外部函数也能访问
            const GAODE_API_KEY = '5af5f1043f8d111d737b55c81a860793';

            // iOS 100vh 修复逻辑 & 全屏交互优化
            const setVH = () => {
                let vh = window.innerHeight * 0.01;
                document.documentElement.style.setProperty('--vh', `${vh}px`);
            };
            setVH();
            window.addEventListener('resize', setVH);
            window.addEventListener('orientationchange', setVH);
            
            // 首次触摸尝试隐藏地址栏 (部分安卓/旧版浏览器有效)
            window.addEventListener('touchstart', () => {
                if (!window.navigator.standalone && !window.matchMedia('(display-mode: standalone)').matches) {
                    window.scrollTo(0, 1);
                }
            }, { once: true });
        }

        document.addEventListener('DOMContentLoaded', () => {
            if (window.__EternOS_DOM_Initialized__) {
                console.warn('DOM 逻辑已初始化，跳过重复执行');
                return;
            }
            window.__EternOS_DOM_Initialized__ = true;

            // --- 核心功能优先初始化：辅助触控 (小白点) ---
            try {
                if (typeof initAssistiveTouch === 'function') {
                    initAssistiveTouch();
                }
            } catch (e) {
                console.error('辅助触控初始化失败:', e);
            }

            // --- 加载控制逻辑 (优化 iOS 兼容性) ---
            const loader = document.getElementById('os-loader');
            let isLoaderFinished = false;

            const finishLoader = () => {
                if (isLoaderFinished) return;
                isLoaderFinished = true;
                
                setTimeout(() => {
                    if (loader) {
                        loader.classList.add('loaded');
                        // 加载完成后立即显示小白点
                        const assistiveTouch = document.getElementById('assistive-touch');
                        if (assistiveTouch) {
                            assistiveTouch.classList.add('show');
                        }
                        // 缩短移除 DOM 的等待时间
                        setTimeout(() => loader.remove(), 400);
                    }
                }, 300); // 显著减少进入主界面的等待延迟
            };

            // 1. 资源加载监控 (主路径)
            window.addEventListener('load', finishLoader);

            // 3. 超时强制解锁 (解决 iOS 某些资源加载卡死问题，如字体或 CDN 异常)
            // 设定 3 秒强行进入系统，确保用户体验
            console.log('Loader safety timer started');
            setTimeout(() => {
                console.log('Safety timer triggered');
                finishLoader();
            }, 3000);

            // 4. 如果 load 事件已经触发，直接完成
            if (document.readyState === 'complete') {
                finishLoader();
            }

            // 5. 初始化 iOS 适配
            if (typeof initIOSAdaptation === 'function') {
                initIOSAdaptation();
            }

            const phoneContainer = document.getElementById('phone-ui-container');
            const homeScreen = document.getElementById('home-screen');
            const wallpaper = document.getElementById('wallpaper');
            const interactiveElements = document.querySelectorAll('[data-app]');
            
            // 绑定应用图标点击事件
            interactiveElements.forEach(element => {
                element.addEventListener('click', (e) => {
                    // 如果正在抖动模式，点击图标不打开应用
                    if (jiggleMode) return;
                    
                    const appName = element.getAttribute('data-app');
                    if (appName === 'home') {
                        closeApps();
                        return;
                    }
                    if (appName) {
                        openApp(appName);
                    }
                });
            });
            const appPages = document.querySelectorAll('.app-page');
            const safariUrlInput = document.getElementById('url-input');
            const safariFrame = document.getElementById('safari-frame');
            const darkModeToggle = document.getElementById('dark-mode-toggle');
            const weatherRetryBtn = document.getElementById('weather-retry-button');
            const gaodeKeyInput = document.getElementById('location-api-key-input');
            const saveKeyBtn = document.getElementById('location-save-btn');
            const cameraViewfinder = document.getElementById('camera-viewfinder');
            const addPhotosBtn = document.getElementById('add-photos-btn');
            const photoFileInput = document.getElementById('photo-file-input');
            const photosGrid = document.getElementById('photos-grid');
            const photosEmptyState = document.getElementById('photos-empty-state');
            // 世界书相关元素
            const worldBookToggle = document.getElementById('world-book-toggle');
            const apiConfigToggle = document.getElementById('api-config-toggle');
            const locationToggle = document.getElementById('location-toggle');
            let cameraStream = null;
            let db;

            // 初始化时钟和日期
            function updateClock() {
                const now = new Date();
                const hours = now.getHours();
                const minutes = now.getMinutes();
                const timeString = `${hours}:${minutes.toString().padStart(2, '0')}`;
                const dateString = `${now.getMonth() + 1}月${now.getDate()}日, ${['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][now.getDay()]}`;
                
                const widgetTime = document.getElementById('widget-time');
                const widgetDate = document.getElementById('widget-date');
                const ccTime = document.getElementById('cc-time');
                
                if (widgetTime) widgetTime.textContent = timeString;
                if (widgetDate) widgetDate.textContent = dateString;
                if (ccTime) ccTime.textContent = timeString;
            }
            updateClock();
            setInterval(updateClock, 60000);

            // 应用切换逻辑
            const implementedApps = ['safari', 'weather', 'settings', 'camera', 'photos', 'themes', 'wechat', 'music', 'calculator', 'worldbook', 'api-config', 'vision-api-config', 'community-api-config', 'memory-manager', 'location', 'general', 'notes', 'clock', 'calendar', 'appstore'];
            
            // --- 应用管理系统 (删除与下载) ---
            let deletedApps = JSON.parse(localStorage.getItem('deletedApps') || '[]');
            let jiggleMode = false;
            let longPressTimer;

            const allApps = [
                { id: 'weather', name: '天气', icon: 'fas fa-cloud-sun', img: 'https://cdn.jim-nielsen.com/ios/1024/weather-2025-10-20.png?rf=1024', color: '#007AFF' },
                { id: 'settings', name: '设置', icon: 'fas fa-cog', img: 'https://r2.image-upload.app/ptImg/VH2EULVh.png', color: '#8E8E93' },
                { id: 'photos', name: '照片', icon: 'fas fa-image', img: 'https://cdn.jim-nielsen.com/ios/1024/photos-2025-10-20.png?rf=1024', color: '#fff' },
                { id: 'camera', name: '相机', icon: 'fas fa-camera', img: 'https://cdn.jim-nielsen.com/ios/1024/camera-2025-10-20.png?rf=1024', color: '#AEAEB2' },
                { id: 'appstore', name: 'App Store', icon: 'fab fa-app-store-ios', img: 'https://cdn.jim-nielsen.com/ios/1024/app-store-connect-2025-10-27.png?rf=1024', color: '#007AFF' },
                { id: 'themes', name: '主题商店', icon: 'fas fa-palette', color: '#5856D6' },
                { id: 'wechat', name: '微信', icon: 'fab fa-weixin', img: 'https://r2.image-upload.app/ptImg/lOlR8NT1.png', color: '#07C160' },
                { id: 'calculator', name: '计算器', icon: 'fas fa-calculator', img: 'https://r2.image-upload.app/ptImg/fG3VllUI.png', color: '#FF9500' },
                { id: 'clock', name: '时钟', icon: 'fas fa-clock', img: 'https://cdn.jim-nielsen.com/ios/1024/clock-2025-05-15.png?rf=1024', color: '#000' },
                { id: 'calendar', name: '日历', icon: 'fas fa-calendar-alt', color: '#fff' },
                { id: 'notes', name: '备忘录', icon: 'fas fa-sticky-note', img: 'https://cdn.jim-nielsen.com/ios/1024/notes-2025-10-20.png?rf=1024', color: '#FFCC00' },
                { id: 'phone', name: '电话', icon: 'fas fa-phone', img: 'https://cdn.jim-nielsen.com/ios/1024/phone-2025-10-20.png?rf=1024', color: '#28CD41' },
                { id: 'safari', name: 'AI 社区', icon: 'fas fa-robot', img: 'https://cdn-icons-png.flaticon.com/512/6134/6134346.png', color: '#fff' },
                { id: 'messages', name: '信息', icon: 'fas fa-comment', img: 'https://cdn.jim-nielsen.com/ios/1024/messages-2025-10-20.png?rf=1024', color: '#28CD41' },
                { id: 'music', name: '音乐', icon: 'fas fa-music', color: '#FF2D55' }
            ];

            window.initAppIcons = function() {
                document.querySelectorAll('.app-icon').forEach(icon => {
                    const appId = icon.dataset.app;
                    if (deletedApps.includes(appId)) {
                        icon.style.display = 'none';
                    } else {
                        icon.style.display = 'flex';
                    }
                });
            }

            window.deleteApp = function(e, appId) {
                e.stopPropagation();
                if (appId === 'settings' || appId === 'appstore') return;
                
                const appInfo = allApps.find(a => a.id === appId);
                const appName = appInfo ? appInfo.name : appId;

                if (confirm(`确认要删除 "${appName}" 吗？`)) {
                    // 从 localStorage 重新读取以确保同步
                    let currentDeleted = JSON.parse(localStorage.getItem('deletedApps') || '[]');
                    if (!currentDeleted.includes(appId)) {
                        currentDeleted.push(appId);
                    }
                    deletedApps = currentDeleted; // 更新闭包变量
                    localStorage.setItem('deletedApps', JSON.stringify(deletedApps));
                    
                    restoreAppLayout();
                    initAppIcons();
                    if (activeApp === 'appstore') renderAppStore();
                }
            }

            window.installApp = function(e, appId) {
                const btn = e.currentTarget || e.target.closest('button') || e.target;
                if (btn.disabled) return;

                // 1. 更新数据状态 (从 localStorage 重新读取以确保同步)
                let currentDeleted = JSON.parse(localStorage.getItem('deletedApps') || '[]');
                currentDeleted = currentDeleted.filter(id => id !== appId);
                deletedApps = currentDeleted; // 更新闭包变量
                localStorage.setItem('deletedApps', JSON.stringify(deletedApps));
                
                // 2. 立即更新主屏幕图标显示
                restoreAppLayout();
                initAppIcons();
                
                // 3. 模拟安装动画反馈
                btn.textContent = '安装中...';
                btn.disabled = true;
                btn.style.opacity = '0.7';

                setTimeout(() => {
                    btn.textContent = '打开';
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    btn.classList.add('installed');
                    btn.onclick = (event) => {
                        event.stopPropagation();
                        openApp(appId);
                    };
                    
                    // 4. 安装完成后，刷新整个列表以保持状态同步
                    setTimeout(() => {
                        renderAppStore();
                    }, 500);
                }, 1200);
            }

            window.renderAppStore = function() {
                const list = document.getElementById('appstore-list');
                if (!list) return;
                
                // 确保渲染前同步最新状态
                deletedApps = JSON.parse(localStorage.getItem('deletedApps') || '[]');
                
                list.innerHTML = allApps.map(app => {
                    const isDeleted = deletedApps.includes(app.id);
                    const iconContent = app.img ? 
                        `<img src="${app.img}" style="width: 100%; height: 100%; border-radius: 20%;">` : 
                        `<i class="${app.icon}"></i>`;
                    return `
                        <div class="appstore-item">
                            <div class="appstore-icon" style="background-color: ${app.color}; display: flex; align-items: center; justify-content: center; color: ${app.color === '#fff' ? '#000' : '#fff'}; font-size: 24px;">
                                ${iconContent}
                            </div>
                            <div class="appstore-info">
                                <div class="appstore-name">${app.name}</div>
                                <div class="appstore-desc">来自官方的应用</div>
                            </div>
                            ${isDeleted ? 
                                `<button class="appstore-get-btn" onclick="installApp(event, '${app.id}')">获取</button>` : 
                                `<button class="appstore-get-btn installed" onclick="openApp('${app.id}')">打开</button>`
                            }
                        </div>
                    `;
                }).join('');
            }

            // 长按进入抖动模式
            document.querySelectorAll('.app-icon').forEach(icon => {
                icon.addEventListener('mousedown', startLongPress);
                icon.addEventListener('touchstart', startLongPress, { passive: true });
                icon.addEventListener('mouseup', cancelLongPress);
                icon.addEventListener('touchend', cancelLongPress, { passive: true });
                icon.addEventListener('mousemove', cancelLongPress);
                icon.addEventListener('touchmove', cancelLongPress, { passive: true });
            });

            function startLongPress(e) {
                if (jiggleMode) return;
                longPressTimer = setTimeout(() => {
                    enterJiggleMode();
                }, 800);
            }

            function cancelLongPress() {
                clearTimeout(longPressTimer);
            }

            let gridSortable, dockSortable;

            // 保存应用布局
            function saveAppLayout() {
                const gridEl = document.querySelector('.apps-grid');
                const dockEl = document.querySelector('.dock');
                if (!gridEl || !dockEl) return;
                
                const gridOrder = Array.from(gridEl.children)
                    .filter(el => el.dataset.app || el.classList.contains('widget'))
                    .map(el => ({
                        id: el.dataset.app || 'widget-main',
                        isWidget: el.classList.contains('widget')
                    }));
                
                const dockOrder = Array.from(dockEl.children)
                    .filter(el => el.dataset.app)
                    .map(el => el.dataset.app);
                
                localStorage.setItem('appLayout_grid', JSON.stringify(gridOrder));
                localStorage.setItem('appLayout_dock', JSON.stringify(dockOrder));
            }

            // 恢复应用布局
            function restoreAppLayout() {
                const gridEl = document.querySelector('.apps-grid');
                const dockEl = document.querySelector('.dock');
                if (!gridEl || !dockEl) return;

                const gridOrder = JSON.parse(localStorage.getItem('appLayout_grid'));
                const dockOrder = JSON.parse(localStorage.getItem('appLayout_dock'));
                
                if (!gridOrder && !dockOrder) return;

                // 获取所有可移动元素
                const gridItems = Array.from(gridEl.children);
                const dockItems = Array.from(dockEl.children);
                const allItems = [...gridItems, ...dockItems];
                
                const itemMap = {};
                allItems.forEach(item => {
                    const id = item.dataset.app || (item.classList.contains('widget') ? 'widget-main' : null);
                    if (id) itemMap[id] = item;
                });

                if (gridOrder) {
                    gridOrder.forEach(info => {
                        const id = typeof info === 'string' ? info : info.id;
                        if (itemMap[id]) {
                            gridEl.appendChild(itemMap[id]);
                        }
                    });
                }

                if (dockOrder) {
                    dockOrder.forEach(appId => {
                        if (itemMap[appId]) {
                            dockEl.appendChild(itemMap[appId]);
                        }
                    });
                }
            }

            function initDragAndDrop() {
                const gridEl = document.querySelector('.apps-grid');
                const dockEl = document.querySelector('.dock');

                if (typeof Sortable === 'undefined') return;

                gridSortable = new Sortable(gridEl, {
                    group: 'apps',
                    animation: 200, // 稍微增加动画时长，让位置交换更平滑
                    disabled: true,
                    easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
                    filter: '.widget',
                    preventOnFilter: false,
                    ghostClass: 'sortable-ghost',
                    dragClass: 'sortable-drag',
                    forceFallback: true, // 保持开启以确保移动端一致性
                    fallbackClass: 'sortable-fallback',
                    fallbackOnBody: true,
                    fallbackTolerance: 5, // 增加容差，防止误触发拖拽
                    swapThreshold: 0.65, // 提高交换阈值，让拖动更稳定
                    invertedSwapThreshold: 0.65,
                    scroll: true,
                    scrollSensitivity: 80, // 提高滚动灵敏度
                    bubbleScroll: true,
                    onAdd: function (evt) {
                        // 当图标从 Dock 拖入网格时，默认排到最后面
                        const gridEl = document.querySelector('.apps-grid');
                        gridEl.appendChild(evt.item);
                        saveAppLayout();
                    },
                    onEnd: saveAppLayout, // 拖拽结束保存布局
                    onMove: function (evt) {
                        if (evt.dragged.classList.contains('widget') && evt.to === dockEl) {
                            return false;
                        }
                    }
                });

                dockSortable = new Sortable(dockEl, {
                    group: {
                        name: 'apps',
                        put: true
                    },
                    animation: 200,
                    disabled: true,
                    direction: 'horizontal',
                    easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
                    ghostClass: 'sortable-ghost',
                    dragClass: 'sortable-drag',
                    forceFallback: true,
                    fallbackClass: 'sortable-fallback',
                    fallbackOnBody: true,
                    fallbackTolerance: 5,
                    swapThreshold: 0.65,
                    invertedSwapThreshold: 0.65,
                    onEnd: saveAppLayout, // 拖拽结束保存布局
                    onAdd: function (evt) {
                        // iOS 现代机型 Dock 栏通常支持最多 4-6 个图标，这里放宽到 6 个
                        if (dockEl.children.length > 6) {
                            const icons = Array.from(dockEl.children);
                            // 找到被挤出来的那个（通常是最后一个，或者是被替换的那个）
                            let displacedIcon;
                            if (evt.item === icons[icons.length - 1]) {
                                displacedIcon = icons[icons.length - 2];
                            } else {
                                displacedIcon = icons[icons.length - 1];
                            }
                            
                            if (displacedIcon) {
                                gridEl.appendChild(displacedIcon);
                            }
                        }
                        saveAppLayout(); // 添加元素后保存
                    },
                    onRemove: saveAppLayout, // 移除元素后保存
                });
            }

            // 在页面加载后初始化拖拽
            setTimeout(initDragAndDrop, 1000);

            function enterJiggleMode() {
                jiggleMode = true;
                document.body.classList.add('jiggle-mode');
                
                // 为每个图标添加随机动画延迟，使抖动看起来更自然
                document.querySelectorAll('.app-icon').forEach(icon => {
                    icon.style.animationDelay = (Math.random() * -0.5) + 's';
                });

                // 启用拖拽
                if (gridSortable) gridSortable.option('disabled', false);
                if (dockSortable) dockSortable.option('disabled', false);

                // 点击背景（home-screen）退出抖动模式
                const exitHandler = (e) => {
                    // 只有点击 home-screen 本身（空白处），或者点击 wallpaper 时才退出
                    if (e.target.id === 'home-screen' || e.target.classList.contains('wallpaper') || e.target.classList.contains('apps-grid-container') || e.target.classList.contains('apps-grid')) {
                        exitJiggleMode();
                        homeScreen.removeEventListener('click', exitHandler);
                        wallpaper.removeEventListener('click', exitHandler);
                    }
                };
                
                homeScreen.addEventListener('click', exitHandler);
                wallpaper.addEventListener('click', exitHandler);
            }

            function exitJiggleMode() {
                jiggleMode = false;
                document.body.classList.remove('jiggle-mode');
                document.querySelectorAll('.app-icon').forEach(icon => {
                    icon.style.animationDelay = '';
                });

                // 禁用拖拽
                if (gridSortable) gridSortable.option('disabled', true);
                if (dockSortable) dockSortable.option('disabled', true);
            }

            restoreAppLayout();
            initAppIcons();
            
            let activeApp = null;
            window.openApp = function(appName) {
                if (jiggleMode) return;
                activeApp = appName;
                
                // 激活动画前添加 will-change
                wallpaper.style.willChange = 'transform, opacity';
                const targetApp = implementedApps.includes(appName) ? document.getElementById(`app-${appName}`) : document.getElementById('app-placeholder');
                if (targetApp) targetApp.style.willChange = 'transform, opacity';

                phoneContainer.classList.add('app-open');
                
                // 确保背景颜色重置
                document.body.style.backgroundColor = ''; 
                
                appPages.forEach(page => page.classList.remove('active'));
                if (targetApp) {
                    targetApp.classList.add('active');
                    if (appName === 'camera') startCamera();
                    if (appName === 'photos') loadPhotosFromDB();
                    if (appName === 'notes') loadNotes();
                    if (appName === 'calendar') renderCalendar();
                    if (appName === 'clock') {
                        startWorldClock();
                        fetchLocalCityForClock();
                    }
                    if (appName === 'appstore') renderAppStore();
                    // 触发应用打开事件
                    document.dispatchEvent(new CustomEvent('appopen', { detail: { app: appName } }));
                }

                // 动画结束后移除 will-change
                setTimeout(() => {
                    wallpaper.style.willChange = 'auto';
                    if (targetApp) targetApp.style.willChange = 'auto';
                }, 450); // 调整延迟以匹配新的 0.4s CSS 过渡时间
            }
            window.closeApps = function() {
                const phoneContainer = document.getElementById('phone-ui-container');
                const appPages = document.querySelectorAll('.app-page');
                
                // 立即移除 active 类，让 CSS 动画瞬间开始
                appPages.forEach(page => {
                    page.classList.remove('active');
                });
                
                phoneContainer.classList.remove('app-open');
                
                // 退出应用时，根据手电筒状态恢复背景颜色
                if (controlStates.flashlight) {
                    document.body.style.backgroundColor = 'rgba(255, 251, 204, 0.8)';
                } else {
                    document.body.style.backgroundColor = '';
                }
                
                // 清理工作不需要延迟那么久
                setTimeout(() => {
                    if (typeof stopCamera === 'function') stopCamera();
                    if (typeof stopVideoCall === 'function') stopVideoCall();
                    if (typeof stopScanCamera === 'function') stopScanCamera();
                    if (typeof stopWorldClock === 'function') stopWorldClock();
                }, 400); 
            }
            wallpaper.addEventListener('click', closeApps);

            // 控制中心功能
            const controlCenter = document.getElementById('control-center');
            let startY = 0;
            let isDragging = false;
            const DRAG_THRESHOLD = 50;

            // 更新控制中心时间
            updateClock();

            // 滑动手势检测
            document.addEventListener('touchstart', (e) => {
                // 如果点击的是 app-page 内部，不触发全局下滑手势（防止干扰应用内滚动）
                if (e.target.closest('.app-page')) return;

                if (e.touches.length === 1) {
                    startY = e.touches[0].clientY;
                    isDragging = true;
                }
            }, { passive: true });

            document.addEventListener('touchend', (e) => {
                if (isDragging) {
                    const endY = e.changedTouches[0].clientY;
                    const dragDistance = endY - startY;

                    // 从顶部向下滑动显示控制中心
                    if (dragDistance > DRAG_THRESHOLD && startY < window.innerHeight * 0.2) {
                        controlCenter.classList.add('active');
                    }

                    isDragging = false;
                }
            }, { passive: true });

            // 点击空白处关闭控制中心
            controlCenter.addEventListener('click', (e) => {
                if (e.target === controlCenter) {
                    controlCenter.classList.remove('active');
                }
            });

            // 控制按钮状态管理
            const controlStates = {
                flashlight: false,
                wifi: true,
                bluetooth: true,
                airplane: false,
                cellular: true
            };

            // 相机功能
            document.getElementById('cc-camera').addEventListener('click', () => {
                openApp('camera');
                controlCenter.classList.remove('active');
            });

            // 计算器功能
            document.getElementById('cc-calculator').addEventListener('click', () => {
                openApp('calculator');
                controlCenter.classList.remove('active');
            });

            // 亮度调节功能 (自定义触摸滑块 - 极致性能优化版)
            const brightnessContainer = document.getElementById('brightness-slider-container');
            const brightnessFill = document.getElementById('cc-brightness-fill');
            const brightnessOverlay = document.getElementById('brightness-overlay');

            if (brightnessContainer) {
                let currentBrightness = localStorage.getItem('screenBrightness') || '100';
                let rafId = null;
                let storageTimeout = null;
                
                updateBrightness(currentBrightness);

                const handleBrightnessInput = (e) => {
                    const rect = brightnessContainer.getBoundingClientRect();
                    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                    const x = clientX - rect.left;
                    let percentage = (x / rect.width) * 100;
                    percentage = Math.max(0, Math.min(100, percentage));
                    
                    // 使用 requestAnimationFrame 确保在浏览器渲染帧内更新 UI，解决卡顿
                    if (rafId) cancelAnimationFrame(rafId);
                    rafId = requestAnimationFrame(() => {
                        updateBrightness(percentage);
                    });

                    // 对 localStorage 写入进行防抖，减少同步 IO 阻塞
                    if (storageTimeout) clearTimeout(storageTimeout);
                    storageTimeout = setTimeout(() => {
                        localStorage.setItem('screenBrightness', percentage.toFixed(0));
                    }, 100);
                };

                // 触摸事件 (非被动，因为需要 preventDefault)
                brightnessContainer.addEventListener('touchstart', (e) => {
                    handleBrightnessInput(e);
                    e.preventDefault();
                }, { passive: false });

                brightnessContainer.addEventListener('touchmove', (e) => {
                    handleBrightnessInput(e);
                    e.preventDefault();
                }, { passive: false });

                // 鼠标事件
                let isMouseDown = false;
                brightnessContainer.addEventListener('mousedown', (e) => {
                    isMouseDown = true;
                    handleBrightnessInput(e);
                });

                document.addEventListener('mousemove', (e) => {
                    if (isMouseDown) handleBrightnessInput(e);
                });

                document.addEventListener('mouseup', () => {
                    isMouseDown = false;
                });
            }

            function updateBrightness(value) {
                if (brightnessFill) brightnessFill.style.width = `${value}%`;
                if (brightnessOverlay) {
                    const opacity = (100 - value) / 100 * 0.6;
                    brightnessOverlay.style.opacity = opacity;
                }
            }

            // 音量调节功能 (自定义触摸滑块 - 极致性能优化版)
            const volumeContainer = document.getElementById('volume-slider-container');
            const volumeFill = document.getElementById('cc-volume-fill');

            if (volumeContainer) {
                let currentVolume = localStorage.getItem('systemVolume') || '50';
                let volumeRafId = null;
                let volumeStorageTimeout = null;

                if (volumeFill) volumeFill.style.width = `${currentVolume}%`;

                const handleVolumeInput = (e) => {
                    const rect = volumeContainer.getBoundingClientRect();
                    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                    const x = clientX - rect.left;
                    let percentage = (x / rect.width) * 100;
                    percentage = Math.max(0, Math.min(100, percentage));
                    
                    if (volumeRafId) cancelAnimationFrame(volumeRafId);
                    volumeRafId = requestAnimationFrame(() => {
                        if (volumeFill) volumeFill.style.width = `${percentage}%`;
                    });

                    if (volumeStorageTimeout) clearTimeout(volumeStorageTimeout);
                    volumeStorageTimeout = setTimeout(() => {
                        localStorage.setItem('systemVolume', percentage.toFixed(0));
                    }, 100);
                };

                volumeContainer.addEventListener('touchstart', (e) => {
                    handleVolumeInput(e);
                    e.preventDefault();
                }, { passive: false });

                volumeContainer.addEventListener('touchmove', (e) => {
                    handleVolumeInput(e);
                    e.preventDefault();
                }, { passive: false });

                let isVolumeMouseDown = false;
                volumeContainer.addEventListener('mousedown', (e) => {
                    isVolumeMouseDown = true;
                    handleVolumeInput(e);
                });

                document.addEventListener('mousemove', (e) => {
                    if (isVolumeMouseDown) handleVolumeInput(e);
                });

                document.addEventListener('mouseup', () => {
                    isVolumeMouseDown = false;
                });
            }

            // 初始化计算器
            function initCalculator() {
                const display = document.getElementById('calculator-display');
                const expressionDisplay = document.getElementById('calculator-expression');
                const historyDisplay = document.getElementById('calculator-history');
                if (!display) return;
                
                let currentValue = '0';
                let previousValue = '';
                let operator = null;
                let shouldResetDisplay = false;
                let calculationHistory = JSON.parse(localStorage.getItem('calculatorHistory') || '[]');

                // 加载历史记录
                function loadHistory() {
                    if (historyDisplay) {
                        historyDisplay.innerHTML = calculationHistory.slice(-3).map(item => 
                            `<div class="calculator-history-item">${item.expression} = ${item.result}</div>`
                        ).join('');
                    }
                }

                // 保存到历史记录
                function saveToHistory(expression, result) {
                    calculationHistory.push({ expression, result, time: new Date().toISOString() });
                    if (calculationHistory.length > 10) {
                        calculationHistory = calculationHistory.slice(-10);
                    }
                    localStorage.setItem('calculatorHistory', JSON.stringify(calculationHistory));
                    loadHistory();
                }

                function updateDisplay() {
                    display.textContent = currentValue;
                    updateExpression();
                }

                function updateExpression() {
                    if (expressionDisplay) {
                        if (operator && previousValue !== '') {
                            const operatorSymbol = {
                                'add': '+',
                                'subtract': '-',
                                'multiply': '×',
                                'divide': '÷'
                            }[operator];
                            expressionDisplay.textContent = `${previousValue} ${operatorSymbol}`;
                        } else {
                            expressionDisplay.textContent = '';
                        }
                    }
                }

                let clearClickCount = 0;
                let clearClickTimer = null;

                function clear() {
                    clearClickCount++;
                    
                    if (clearClickCount === 1) {
                        // 第一次点击：清零当前计算
                        currentValue = '0';
                        previousValue = '';
                        operator = null;
                        shouldResetDisplay = false;
                        updateDisplay();
                        
                        // 启动计时器，1.5秒内没有第二次点击则重置计数
                        clearClickTimer = setTimeout(() => {
                            clearClickCount = 0;
                        }, 1500);
                    } else if (clearClickCount === 2) {
                        // 第二次点击：清除历史记录
                        clearTimeout(clearClickTimer);
                        clearClickCount = 0;
                        calculationHistory = [];
                        localStorage.removeItem('calculatorHistory');
                        loadHistory();
                        

                    }
                }

                function negate() {
                    if (currentValue !== '0') {
                        currentValue = currentValue.startsWith('-') ? currentValue.slice(1) : '-' + currentValue;
                        updateDisplay();
                    }
                }

                function percent() {
                    const value = parseFloat(currentValue);
                    currentValue = String(value / 100);
                    updateDisplay();
                }

                function appendNumber(number) {
                    if (shouldResetDisplay) {
                        currentValue = number;
                        shouldResetDisplay = false;
                    } else {
                        currentValue = currentValue === '0' ? number : currentValue + number;
                    }
                    updateDisplay();
                }

                function appendDecimal() {
                    if (shouldResetDisplay) {
                        currentValue = '0.';
                        shouldResetDisplay = false;
                    } else if (!currentValue.includes('.')) {
                        currentValue += '.';
                    }
                    updateDisplay();
                }

                function setOperator(nextOperator) {
                    const inputValue = parseFloat(currentValue);

                    if (operator && shouldResetDisplay) {
                        operator = nextOperator;
                        updateExpression();
                        return;
                    }

                    if (previousValue === '') {
                        previousValue = currentValue;
                    } else if (operator) {
                        const result = calculate();
                        currentValue = String(result);
                        previousValue = currentValue;
                    }

                    shouldResetDisplay = true;
                    operator = nextOperator;
                    updateDisplay();
                }

                function calculate() {
                    const inputValue = parseFloat(currentValue);
                    const prevValue = parseFloat(previousValue);
                    if (isNaN(prevValue) || isNaN(inputValue)) return inputValue;
                    let result = 0;
                    switch (operator) {
                        case 'add':
                            result = prevValue + inputValue;
                            break;
                        case 'subtract':
                            result = prevValue - inputValue;
                            break;
                        case 'multiply':
                            result = prevValue * inputValue;
                            break;
                        case 'divide':
                            result = prevValue / inputValue;
                            break;
                        default:
                            return inputValue;
                    }
                    
                    return parseFloat(result.toFixed(10));
                }

                function compute() {
                    if (operator && previousValue !== '') {
                        const operatorSymbol = {
                            'add': '+',
                            'subtract': '-',
                            'multiply': '×',
                            'divide': '÷'
                        }[operator];
                        const expression = `${previousValue} ${operatorSymbol} ${currentValue}`;
                        const result = calculate();
                        currentValue = String(result);
                        saveToHistory(expression, currentValue);
                        operator = null;
                        previousValue = '';
                        shouldResetDisplay = true;
                        updateDisplay();
                    }
                }

                // 初始化时加载历史记录
                loadHistory();

                let easterEggSequence = [];

                let currentCharIdForMemory = null;

                window.renderCharacterMemoryList = function() {
                    const list = document.getElementById('char-memory-list');
                    if (!list || typeof wechatState === 'undefined' || !wechatState.characters) return;

                    list.innerHTML = '';
                    
                    if (wechatState.characters.length === 0) {
                        list.innerHTML = '<div style="text-align:center; padding: 20px; color: #8e8e93;">没有角色</div>';
                        return;
                    }

                    wechatState.characters.forEach(char => {
                        const charDiv = document.createElement('div');
                        charDiv.style.background = '#fff';
                        charDiv.style.borderRadius = '12px';
                        charDiv.style.padding = '16px';
                        charDiv.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                        charDiv.style.marginBottom = '12px';
                        charDiv.style.cursor = 'pointer';
                        charDiv.onclick = function() {
                            openCharMemoryEditor(char.id);
                        };
                        
                        charDiv.innerHTML = `
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <img src="${char.avatar}" style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover; background: #eee;">
                                    <div style="font-weight: 600; font-size: 16px;">${char.name}</div>
                                </div>
                                <i class="fas fa-chevron-right" style="color: #c7c7cc;"></i>
                            </div>
                        `;
                        list.appendChild(charDiv);
                    });
                };

                window.openCharMemoryEditor = function(charId) {
                    const char = wechatState.characters.find(c => c.id == charId);
                    if (!char) return;
                    currentCharIdForMemory = charId;
                    
                    const editor = document.getElementById('char-memory-editor');
                    const title = document.getElementById('char-memory-editor-title');
                    title.innerText = char.name + '的记忆';
                    
                    renderCharMemoryEditorContent(charId);
                    
                    editor.style.display = 'flex';
                    // force reflow
                    editor.offsetHeight;
                    editor.style.transform = 'translateX(0)';
                };

                window.closeCharMemoryEditor = function() {
                    const editor = document.getElementById('char-memory-editor');
                    editor.style.transform = 'translateX(100%)';
                    setTimeout(() => {
                        editor.style.display = 'none';
                        currentCharIdForMemory = null;
                    }, 300);
                };

                window.renderCharMemoryEditorContent = function(charId) {
                    const char = wechatState.characters.find(c => c.id == charId);
                    const container = document.getElementById('char-memory-editor-content');
                    if (!char || !container) return;

                    let memories = [];
                    if (Array.isArray(char.memory)) {
                        memories = char.memory;
                    } else if (typeof char.memory === 'string' && char.memory.trim() !== '') {
                        memories = char.memory.split('\n')
                            .map(m => m.trim())
                            .filter(m => m !== '')
                            .map(m => m.replace(/^\d+\.\s*/, ''));
                    }

                    let memoryItemsHtml = '';
                    if (memories.length === 0) {
                        memoryItemsHtml = '<div style="color: #8e8e93; font-size: 14px; padding: 20px 0; text-align: center;">暂无记忆</div>';
                    } else {
                        memories.forEach((mem, idx) => {
                            memoryItemsHtml += `
                                <div style="display: flex; align-items: flex-start; justify-content: space-between; padding: 12px; background: #fff; border-radius: 8px; margin-bottom: 8px; font-size: 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                    <div style="flex: 1; word-break: break-word; line-height: 1.4; cursor: pointer;" onclick="editSingleCharMemory('${char.id}', ${idx})" id="mem-text-${char.id}-${idx}">${mem}</div>
                                    <div style="display: none; flex: 1; margin-right: 8px;" id="mem-edit-${char.id}-${idx}">
                                        <input type="text" id="mem-input-${char.id}-${idx}" value="${mem.replace(/"/g, '&quot;')}" style="width: 100%; padding: 4px 8px; border: 1px solid #007aff; border-radius: 4px; font-size: 14px; outline: none;">
                                        <div style="display: flex; gap: 4px; margin-top: 4px;">
                                            <button onclick="saveEditCharMemory('${char.id}', ${idx})" style="background: #007aff; color: #fff; border: none; padding: 4px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">保存</button>
                                            <button onclick="cancelEditCharMemory('${char.id}', ${idx})" style="background: #e5e5ea; color: #000; border: none; padding: 4px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">取消</button>
                                        </div>
                                    </div>
                                    <button onclick="deleteSingleCharMemory('${char.id}', ${idx})" style="background: none; border: none; color: #ff3b30; cursor: pointer; padding: 4px; margin-left: 8px;">
                                        <i class="fas fa-trash-alt"></i>
                                    </button>
                                </div>
                            `;
                        });
                    }

                    container.innerHTML = `
                        <div style="margin-bottom: 20px;">
                            ${memoryItemsHtml}
                        </div>
                        <div style="display: flex; gap: 8px; background: #fff; padding: 12px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                            <input type="text" id="char-memory-input-${char.id}" placeholder="添加新记忆条目..." style="flex: 1; padding: 8px; border: none; font-size: 15px; outline: none; background: transparent;">
                            <button onclick="addSingleCharMemory('${char.id}')" style="background: #007aff; color: #fff; border: none; padding: 0 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap;">添加</button>
                        </div>
                    `;
                };

                window.addSingleCharMemory = async function(charId) {
                    const char = wechatState.characters.find(c => c.id == charId);
                    const input = document.getElementById(`char-memory-input-${charId}`);
                    const newMemory = input.value.trim();
                    
                    if (char && newMemory) {
                        if (!Array.isArray(char.memory)) {
                            if (typeof char.memory === 'string' && char.memory.trim() !== '') {
                                char.memory = char.memory.split('\n')
                                    .map(m => m.trim())
                                    .filter(m => m !== '')
                                    .map(m => m.replace(/^\d+\.\s*/, ''));
                            } else {
                                char.memory = [];
                            }
                        }
                        char.memory.push(newMemory);
                        if (typeof saveWechatData === 'function') {
                            await saveWechatData();
                        }
                        // Refresh the detail view
                        renderCharMemoryEditorContent(charId);
                    }
                };

                window.editSingleCharMemory = function(charId, index) {
                    const textEl = document.getElementById(`mem-text-${charId}-${index}`);
                    const editEl = document.getElementById(`mem-edit-${charId}-${index}`);
                    const inputEl = document.getElementById(`mem-input-${charId}-${index}`);
                    
                    if (textEl && editEl && inputEl) {
                        textEl.style.display = 'none';
                        editEl.style.display = 'block';
                        inputEl.focus();
                    }
                };

                window.cancelEditCharMemory = function(charId, index) {
                    const textEl = document.getElementById(`mem-text-${charId}-${index}`);
                    const editEl = document.getElementById(`mem-edit-${charId}-${index}`);
                    
                    if (textEl && editEl) {
                        editEl.style.display = 'none';
                        textEl.style.display = 'block';
                    }
                };

                window.saveEditCharMemory = async function(charId, index) {
                    const char = wechatState.characters.find(c => c.id == charId);
                    const inputEl = document.getElementById(`mem-input-${charId}-${index}`);
                    
                    if (char && inputEl && Array.isArray(char.memory) && index >= 0 && index < char.memory.length) {
                        const newText = inputEl.value.trim();
                        if (newText) {
                            char.memory[index] = newText;
                            if (typeof saveWechatData === 'function') {
                                await saveWechatData();
                            }
                            renderCharMemoryEditorContent(charId);
                        } else {
                            // 如果修改为空，则相当于删除
                            deleteSingleCharMemory(charId, index);
                        }
                    }
                };

                window.deleteSingleCharMemory = async function(charId, index) {
                    if (confirm('确定要删除这条记忆吗？')) {
                        const char = wechatState.characters.find(c => c.id == charId);
                        if (char) {
                            if (!Array.isArray(char.memory)) {
                                if (typeof char.memory === 'string' && char.memory.trim() !== '') {
                                    char.memory = char.memory.split('\n')
                                        .map(m => m.trim())
                                        .filter(m => m !== '')
                                        .map(m => m.replace(/^\d+\.\s*/, ''));
                                } else {
                                    char.memory = [];
                                }
                            }
                            if (index >= 0 && index < char.memory.length) {
                                char.memory.splice(index, 1);
                                if (typeof saveWechatData === 'function') {
                                    await saveWechatData();
                                }
                                // Refresh the detail view
                                renderCharMemoryEditorContent(charId);
                            }
                        }
                    }
                };

                window.showCharacterMemoryPage = function() {
                    const page = document.getElementById('app-char-memory');
                    
                    if (typeof wechatState === 'undefined' || !wechatState.characters) {
                        alert('未找到角色数据');
                        return;
                    }

                    renderCharacterMemoryList();

                    page.classList.add('active');
                };

                window.closeCharacterMemoryPage = function() {
                    document.getElementById('app-char-memory').classList.remove('active');
                };



                // 事件监听
                const buttons = document.querySelectorAll('.calculator-btn');
                buttons.forEach(button => {
                    button.addEventListener('click', () => {
                        const action = button.dataset.action;
                        const number = button.dataset.number;
                        const key = action || number;

                        easterEggSequence.push(key);
                        if (easterEggSequence.length > 9) easterEggSequence.shift();

                        // 密码：5201314.-
                        if (easterEggSequence.join(',') === '5,2,0,1,3,1,4,decimal,subtract') {
                            easterEggSequence = [];
                            // 打开升级后的记忆管理器
                            openApp('memory-manager');
                            renderMemoryManager();
                            // 重置计算器状态
                            clearClickCount = 0;
                            clear();
                            return;
                        }
                        
                        if (button.classList.contains('calculator-btn-number')) {
                            if (action === 'decimal') {
                                appendDecimal();
                            } else {
                                appendNumber(button.dataset.number);
                            }
                        } else if (button.classList.contains('calculator-btn-function')) {
                            switch (action) {
                                case 'clear':
                                    clear();
                                    break;
                                case 'negate':
                                    negate();
                                    break;
                                case 'percent':
                                    percent();
                                    break;
                            }
                        } else if (button.classList.contains('calculator-btn-operator')) {
                            if (action === 'equals') {
                                compute();
                            } else {
                                setOperator(action);
                            }
                        }
                    });
                });
            }
            
            // 调用初始化函数
            initCalculator();

            // 闹钟功能
            document.getElementById('cc-alarm').addEventListener('click', () => {
                // 简单的闹钟设置界面
                const alarmDiv = document.createElement('div');
                alarmDiv.innerHTML = `
                    <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); z-index: 2000; width: 300px;">
                        <h3 style="margin-top: 0;text-align: center;">设置闹钟</h3>
                        <div style="margin: 20px 0;">
                            <label style="display: block; margin-bottom: 8px;">时间</label>
                            <input type="time" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 8px;">
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <button style="flex: 1; padding: 10px; border: none; border-radius: 8px; background: #4CAF50; color: white; cursor: pointer;">保存</button>
                            <button style="flex: 1; padding: 10px; border: none; border-radius: 8px; background: #ccc; cursor: pointer;">取消</button>
                        </div>
                    </div>
                    <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1999;"></div>
                `;
                
                document.body.appendChild(alarmDiv);
                
                // 闹钟事件处理
                alarmDiv.querySelector('button:nth-of-type(1)').addEventListener('click', () => {
                    alert('闹钟已设置');
                    document.body.removeChild(alarmDiv);
                });
                
                alarmDiv.querySelector('button:nth-of-type(2)').addEventListener('click', () => {
                    document.body.removeChild(alarmDiv);
                });
                
                alarmDiv.querySelector('div:last-child').addEventListener('click', () => {
                    document.body.removeChild(alarmDiv);
                });
            });

            // 控制中心按钮状态切换函数
            function updateCCButtons() {
                const wifiBtn = document.getElementById('cc-wifi');
                const bluetoothBtn = document.getElementById('cc-bluetooth');
                const airplaneBtn = document.getElementById('cc-airplane');
                const cellularBtn = document.getElementById('cc-cellular');
                const flashlightBtn = document.getElementById('cc-flashlight');

                if (wifiBtn) {
                    if (controlStates.wifi) wifiBtn.classList.add('active'); else wifiBtn.classList.remove('active');
                }
                if (bluetoothBtn) {
                    if (controlStates.bluetooth) bluetoothBtn.classList.add('active'); else bluetoothBtn.classList.remove('active');
                }
                if (airplaneBtn) {
                    if (controlStates.airplane) airplaneBtn.classList.add('active'); else airplaneBtn.classList.remove('active');
                }
                if (cellularBtn) {
                    if (controlStates.cellular) cellularBtn.classList.add('active'); else cellularBtn.classList.remove('active');
                }
                if (flashlightBtn) {
                    if (controlStates.flashlight) flashlightBtn.classList.add('active'); else flashlightBtn.classList.remove('active');
                }
            }

            // Wi-Fi功能
            document.getElementById('cc-wifi').addEventListener('click', () => {
                controlStates.wifi = !controlStates.wifi;
                updateCCButtons();
            });

            // 蓝牙功能
            document.getElementById('cc-bluetooth').addEventListener('click', () => {
                controlStates.bluetooth = !controlStates.bluetooth;
                updateCCButtons();
            });

            // 飞行模式功能
            document.getElementById('cc-airplane').addEventListener('click', () => {
                controlStates.airplane = !controlStates.airplane;
                if (controlStates.airplane) {
                    controlStates.wifi = false;
                    controlStates.bluetooth = false;
                    controlStates.cellular = false;
                } else {
                    controlStates.wifi = true;
                    controlStates.bluetooth = true;
                    controlStates.cellular = true;
                }
                updateCCButtons();
            });

            // 蜂窝数据功能
            document.getElementById('cc-cellular').addEventListener('click', () => {
                controlStates.cellular = !controlStates.cellular;
                updateCCButtons();
            });

            // 手电筒功能
            document.getElementById('cc-flashlight').addEventListener('click', () => {
                controlStates.flashlight = !controlStates.flashlight;
                const flashlightBtn = document.getElementById('cc-flashlight');
                
                if (controlStates.flashlight) {
                    document.body.style.backgroundColor = 'rgba(255, 251, 204, 0.8)';
                } else {
                    document.body.style.backgroundColor = '';
                }
                updateCCButtons();
            });

            // 初始化按钮状态
            updateCCButtons();


            // 鼠标事件支持（用于桌面测试）
            let mouseStartY = 0;
            let isMouseDragging = false;

            document.addEventListener('mousedown', (e) => {
                mouseStartY = e.clientY;
                isMouseDragging = true;
            });

            document.addEventListener('mouseup', (e) => {
                if (isMouseDragging) {
                    const endY = e.clientY;
                    const dragDistance = endY - mouseStartY;

                    // 从顶部向下滑动显示控制中心
                    if (dragDistance > DRAG_THRESHOLD && mouseStartY < window.innerHeight * 0.2) {
                        controlCenter.classList.add('active');
                    }

                    isMouseDragging = false;
                }
            });

            // 相机和照片功能
            let currentCamera = 'user'; // 'user' 为前置相机, 'environment' 为后置相机
            let cameraMode = 'photo'; // 'photo', 'video', etc.
            
            async function startCamera() {
                try {
                    const cameraViewfinder = document.getElementById('camera-viewfinder');
                    if (!cameraViewfinder) {
                        alert('无法找到相机元素。');
                        return;
                    }

                    // 如果已经有流在运行，先停止它
                    if (cameraStream) {
                        stopCamera();
                    }

                    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                        throw new Error('浏览器不支持或未授权访问相机');
                    }

                    const constraints = {
                        video: {
                            facingMode: currentCamera,
                            width: { ideal: 1920 },
                            height: { ideal: 1080 }
                        }
                    };

                    cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
                    cameraViewfinder.srcObject = cameraStream;
                    
                    // 确保视频开始播放
                    try {
                        const playPromise = cameraViewfinder.play();
                        if (playPromise !== undefined) {
                            playPromise.catch(error => {
                                console.warn("Video play prevented, waiting for user interaction:", error);
                                // 这种情况下，用户可能需要点击取景器来开始播放
                                cameraViewfinder.addEventListener('click', () => {
                                    cameraViewfinder.play();
                                }, { once: true });
                            });
                        }
                    } catch (playErr) {
                        console.warn("Video play interrupted:", playErr);
                    }
                    
                    // 处理前置摄像头镜像预览
                    if (currentCamera === 'user') {
                        cameraViewfinder.style.transform = 'scaleX(-1)';
                    } else {
                        cameraViewfinder.style.transform = 'scaleX(1)';
                    }
                    
                    // 更新相册预览图
                    updateCameraGalleryPreview();
                    
                } catch (err) {
                    console.error("Camera Error:", err);
                    // 如果指定模式失败，尝试不带 facingMode 启动
                    try {
                        cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
                        const cameraViewfinder = document.getElementById('camera-viewfinder');
                        cameraViewfinder.srcObject = cameraStream;
                        cameraViewfinder.style.transform = 'none';
                    } catch (retryErr) {
                        alert('无法访问摄像头，请确保已授予权限。');
                        closeApps();
                    }
                }
            }
            
            // 切换相机
            async function switchCamera() {
                // 切换相机模式变量
                currentCamera = currentCamera === 'user' ? 'environment' : 'user';
                
                // 停止当前相机并重新启动
                stopCamera();
                await startCamera();
            }

            // 更新相机左下角相册预览
            function updateCameraGalleryPreview() {
                const galleryBtn = document.getElementById('camera-gallery-btn');
                if (!galleryBtn || !db) return;

                const transaction = db.transaction('photos', 'readonly');
                const store = transaction.objectStore('photos');
                const request = store.getAll();
                
                request.onsuccess = () => {
                    const photos = request.result;
                    if (photos && photos.length > 0) {
                        // 获取最后一张照片
                        const lastPhoto = photos[photos.length - 1];
                        galleryBtn.innerHTML = `<img src="${lastPhoto.data}">`;
                    } else {
                        galleryBtn.innerHTML = `<i class="fas fa-images"></i>`;
                    }
                };
            }
            
            function stopCamera() {
                if (cameraStream) {
                    cameraStream.getTracks().forEach(track => track.stop());
                    cameraStream = null;
                }
            }
            
            // 初始化相机事件监听
            // 拍照按钮
            const shutterBtn = document.getElementById('shutter-button');
            if (shutterBtn) {
                const handleCapture = (e) => {
                    // 只有在点击或触摸时触发
                    if (e.type === 'touchstart') {
                        // 如果是触摸事件，防止触发后续的 click 事件
                        // 但不要在所有情况下都 preventDefault，以免影响 CSS :active 状态
                        // e.preventDefault(); 
                    }
                    e.stopPropagation();
                    takePhoto();
                };
                
                // 使用 click 作为主要触发方式，它在移动端也有很好的支持（虽然有延迟，但对于拍照按钮通常可以接受）
                // 或者我们可以使用 pointerdown 来获得更快的响应
                shutterBtn.addEventListener('click', handleCapture);
                // 暂时移除 touchstart 以避免双重触发或冲突，click 在移动端通常足够
            }

            // 切换相机按钮
            const cameraSwitchBtn = document.getElementById('camera-switch-btn');
            if (cameraSwitchBtn) {
                cameraSwitchBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    switchCamera();
                });
            }

            // 打开相册按钮
            const galleryBtn = document.getElementById('camera-gallery-btn');
            if (galleryBtn) {
                galleryBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openApp('photos');
                });
            }

            // 模式选择
            const modeOptions = document.querySelectorAll('#camera-mode-selector .mode-option');
            modeOptions.forEach(option => {
                option.addEventListener('click', () => {
                    modeOptions.forEach(opt => opt.classList.remove('active'));
                    option.classList.add('active');
                    cameraMode = option.dataset.mode;
                });
            });

            function initDB() {
                try {
                    const request = indexedDB.open('photoAppDB', 1);
                    request.onupgradeneeded = e => {
                        db = e.target.result;
                        db.createObjectStore('photos', { keyPath: 'id' });
                    };
                    request.onsuccess = e => {
                        db = e.target.result;
                        // 数据库就绪后立即预加载相册，防止打开应用时闪烁
                        loadPhotosFromDB();
                    };
                    request.onerror = e => {
                        console.error('IndexedDB error:', e.target.error || e.target.errorCode);
                    };
                } catch (error) {
                    console.warn('IndexedDB 初始化失败, 可能是由于隐私模式或浏览器限制:', error);
                }
            }
            // 初始化照片应用数据库
            initDB();
            
            // 确保在数据库初始化完成后尝试更新预览
            const checkDBInterval = setInterval(() => {
                if (db) {
                    updateCameraGalleryPreview();
                    clearInterval(checkDBInterval);
                }
            }, 500);
            setTimeout(() => clearInterval(checkDBInterval), 5000); // 最多检查5秒
            let isImporting = false;
            window.triggerPhotoImport = function() {
                if (isImporting) return;
                if (!db) {
                    alert('相册系统正在初始化，请稍后再试...');
                    initDB();
                    return;
                }
                isImporting = true;
                photoFileInput.click();
                // 300ms 后重置，防止 iOS 双击穿透或重复触发
                setTimeout(() => { isImporting = false; }, 300);
            };
            addPhotosBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                triggerPhotoImport();
            });
            photoFileInput.addEventListener('change', (e) => {
                const files = e.target.files;
                if (!files.length || !db) {
                    if (!db) console.error('数据库未就绪');
                    return;
                }
                
                let addedCount = 0;
                let loadedData = [];
                
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        loadedData.push({
                            id: `${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
                            data: event.target.result,
                            name: file.name,
                            type: file.type,
                            date: new Date().getTime()
                        });
                        
                        addedCount++;
                        if (addedCount === files.length) {
                            saveAllPhotos(loadedData);
                        }
                    };
                    reader.onerror = () => {
                        console.error('读取文件失败:', file.name);
                        addedCount++;
                        if (addedCount === files.length) {
                            saveAllPhotos(loadedData);
                        }
                    };
                    reader.readAsDataURL(file);
                }
                
                function saveAllPhotos(dataList) {
                    if (dataList.length === 0) return;
                    
                    const transaction = db.transaction('photos', 'readwrite');
                    const store = transaction.objectStore('photos');
                    
                    dataList.forEach(photo => {
                        store.add(photo);
                    });
                    
                    transaction.oncomplete = () => {
                        loadPhotosFromDB(true); // 强制刷新
                        updateCameraGalleryPreview(); // 同时更新相机的预览
                        alert(`成功导入 ${dataList.length} 张照片到相册`);
                        photoFileInput.value = ''; // 清空 input 以便下次导入
                    };
                    
                    transaction.onerror = (err) => {
                        console.error('事务失败:', err);
                        alert('导入失败，请重试');
                    };
                }
            });
            let isPhotosRendered = false;
            let lastPhotoCount = 0;

            function loadPhotosFromDB(force = false) {
                if (!db) return;
                const transaction = db.transaction('photos', 'readonly');
                const store = transaction.objectStore('photos');
                const request = store.getAll();
                request.onsuccess = () => {
                    const photos = request.result;
                    
                    // 如果不是强制刷新，且图片数量没变，且已经渲染过，则跳过以防止闪烁
                    if (!force && isPhotosRendered && photos.length === lastPhotoCount) {
                        return;
                    }

                    const photosContainer = document.getElementById('photos-container');
                    if (!photosContainer) return;

                    photosContainer.innerHTML = '';
                    lastPhotoCount = photos.length;
                    isPhotosRendered = true;
                    
                    if (photos.length > 0) {
                        photosEmptyState.style.display = 'none';
                        
                        // 按日期分组（这里简化处理，所有照片都放在今天的分组中）
                        const today = new Date().toLocaleDateString('zh-CN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        });
                        
                        const section = document.createElement('div');
                        section.className = 'photo-section';
                        
                        const sectionHeader = document.createElement('div');
                        sectionHeader.className = 'photo-section-header';
                        
                        const sectionTitle = document.createElement('div');
                        sectionTitle.className = 'photo-section-title';
                        sectionTitle.textContent = today;
                        
                        const sectionAll = document.createElement('div');
                        sectionAll.className = 'photo-section-all';
                        sectionAll.textContent = '显示全部';
                        
                        sectionHeader.appendChild(sectionTitle);
                        sectionHeader.appendChild(sectionAll);
                        section.appendChild(sectionHeader);
                        
                        const grid = document.createElement('div');
                        grid.id = 'photos-grid';
                        
                        // 为照片添加布局类型
                        photos.forEach((photo, index) => {
                            const photoItem = document.createElement('div');
                            photoItem.className = 'photo-item';
                            
                            // 所有照片使用相同的布局
                            
                            const img = document.createElement('img');
                            img.src = photo.data;
                            img.loading = 'lazy'; // 添加懒加载，防止大量高清图片导致内存溢出闪退
                            
                            // 点击查看照片
                            img.addEventListener('click', () => {
                                viewPhoto(photo.data);
                            });
                            
                            // 长按保存到本地
                            let longPressTimer;
                            img.addEventListener('mousedown', () => {
                                longPressTimer = setTimeout(() => {
                                    savePhotoToLocal(photo.data);
                                }, 800);
                            });
                            
                            img.addEventListener('mouseup', () => {
                                clearTimeout(longPressTimer);
                            });
                            
                            img.addEventListener('mouseleave', () => {
                                clearTimeout(longPressTimer);
                            });
                            
                            // 移动端触摸事件
                            img.addEventListener('touchstart', () => {
                                longPressTimer = setTimeout(() => {
                                    savePhotoToLocal(photo.data);
                                }, 800);
                            }, { passive: true });
                            
                            img.addEventListener('touchend', () => {
                                clearTimeout(longPressTimer);
                            }, { passive: true });
                            
                            photoItem.appendChild(img);
                            grid.appendChild(photoItem);
                        });
                        
                        section.appendChild(grid);
                        photosContainer.appendChild(section);
                    } else {
                        photosEmptyState.style.display = 'flex';
                    }
                };
            }

            // 拍照功能
            function takePhoto() {
                try {
                    if (!cameraStream) {
                        console.error('相机未准备好');
                        alert('相机未准备好，请稍候或检查相机权限。');
                        return;
                    }

                    const cameraViewfinder = document.getElementById('camera-viewfinder');
                    if (!cameraViewfinder) {
                        alert('找不到取景器元素。');
                        return;
                    }
                    const canvas = document.createElement('canvas');
                    
                    // 解决某些浏览器下 videoWidth 为 0 的问题
                    const width = cameraViewfinder.videoWidth || cameraViewfinder.clientWidth || 1920;
                    const height = cameraViewfinder.videoHeight || cameraViewfinder.clientHeight || 1080;
                    
                    if (width === 0 || height === 0) {
                        console.error('无法获取视频尺寸');
                        return;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    
                    // 如果是前置摄像头，拍照时需要水平翻转，因为预览是镜像的，但流本身通常不是镜像的
                    // 但 iOS Safari 的 getUserMedia 表现各异，这里我们保持原始流绘制
                    // 绘制原始视频流
                    ctx.drawImage(cameraViewfinder, 0, 0, canvas.width, canvas.height);

                    // 拍照闪光效果
                    const flash = document.getElementById('camera-flash');
                    if (flash) {
                        flash.style.display = 'block';
                        flash.style.animation = 'shutter-flash 0.15s ease-out';
                        setTimeout(() => {
                            flash.style.display = 'none';
                            flash.style.animation = '';
                        }, 150);
                    }

                    // 震动反馈 (如果支持)
                    if (navigator.vibrate) {
                        navigator.vibrate(10);
                    }

                    // 将照片转换为data URL
                    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.9);

                    // 保存照片到IndexedDB
                    savePhotoToDB(photoDataUrl);
                    
                    // 更新相机左下角缩略图
                    setTimeout(updateCameraGalleryPreview, 100);
                } catch (err) {
                    console.error("Take photo error:", err);
                    alert('拍照失败: ' + err.message);
                }
            }

            // 查看照片
            function viewPhoto(photoData) {
                window.previewImage(photoData);
            }

            // 全局图片预览函数
            window.previewImage = function(imageData) {
                if (!imageData) return;
                
                const existing = document.querySelector('.image-viewer-overlay');
                if (existing) existing.remove();

                const overlay = document.createElement('div');
                overlay.className = 'image-viewer-overlay';
                overlay.style.cssText = `
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: #000; z-index: 100000; display: flex;
                    align-items: center; justify-content: center;
                    animation: fadeIn 0.2s; touch-action: none;
                `;
                
                const img = document.createElement('img');
                img.src = imageData;
                img.style.cssText = `
                    max-width: 100%; max-height: 100%;
                    object-fit: contain; transition: transform 0.3s ease;
                `;
                
                let scale = 1;
                overlay.onclick = () => {
                    overlay.style.opacity = '0';
                    setTimeout(() => overlay.remove(), 200);
                };

                img.onclick = (e) => {
                    e.stopPropagation();
                    scale = scale === 1 ? 2 : 1;
                    img.style.transform = `scale(${scale})`;
                    img.style.cursor = scale === 1 ? 'zoom-in' : 'zoom-out';
                };

                const closeBtn = document.createElement('div');
                closeBtn.innerHTML = '<i class="fas fa-times"></i>';
                closeBtn.style.cssText = `
                    position: absolute; top: 40px; right: 20px;
                    width: 40px; height: 40px; background: rgba(255,255,255,0.2);
                    color: #fff; border-radius: 50%; display: flex;
                    align-items: center; justify-content: center; font-size: 20px;
                `;

                overlay.appendChild(img);
                overlay.appendChild(closeBtn);
                document.body.appendChild(overlay);
            };

            // 保存照片到本地
            function savePhotoToLocal(photoData) {
                if (confirm('是否要保存此照片到本地？')) {
                    const link = document.createElement('a');
                    link.download = `photo_${new Date().getTime()}.jpg`;
                    link.href = photoData;
                    link.click();
                    alert('照片已保存到本地');
                }
            }

            // 保存照片到数据库
            function savePhotoToDB(photoDataUrl) {
                return new Promise((resolve, reject) => {
                    if (!db) {
                        const error = new Error('数据库未初始化');
                        console.error(error.message);
                        reject(error);
                        return;
                    }

                    try {
                        const transaction = db.transaction('photos', 'readwrite');
                        const store = transaction.objectStore('photos');
                        const photoData = {
                            id: Date.now() + Math.random(),
                            data: photoDataUrl
                        };
                        store.add(photoData);

                        transaction.oncomplete = () => {
                            console.log('照片保存成功');
                            updateCameraGalleryPreview();
                            if (activeApp === 'photos') {
                                loadPhotosFromDB(true);
                            }
                            resolve(photoData);
                        };

                        transaction.onerror = () => {
                            const error = transaction.error || new Error('照片保存失败');
                            console.error('照片保存失败', error);
                            reject(error);
                        };
                    } catch (error) {
                        console.error('保存照片到数据库时出错:', error);
                        reject(error);
                    }
                });
            }

            // --- AI 小说与论坛功能 ---
            const aiNovelMessages = document.getElementById('ai-novel-messages');
            const aiNovelInput = document.getElementById('ai-novel-input');
            const aiNovelSend = document.getElementById('ai-novel-send');
            const forumPostList = document.getElementById('forum-post-list');
            const aiForumUrlInput = document.getElementById('ai-forum-url-input');
            const aiForumViews = document.querySelectorAll('.sub-view');
            const aiForumRefresh = document.getElementById('ai-forum-refresh');

            // 路由映射逻辑
            window.routeByUrl = function(url) {
                if (!url || url.trim() === '') {
                    // 默认显示首页文字页
                    aiForumViews.forEach(v => v.classList.remove('active'));
                    document.getElementById('search-view').classList.add('active');
                    aiForumUrlInput.value = '';
                    return;
                }
                const cleanUrl = url.trim().toLowerCase();
                
                // 默认隐藏所有视图
                aiForumViews.forEach(v => v.classList.remove('active'));
                
                if (cleanUrl.includes('seeu.novel.ai')) {
                    document.getElementById('ai-novel-view').classList.add('active');
                    aiForumUrlInput.value = 'seeu.novel.ai';
                } else if (cleanUrl.includes('chat.seeu.ai')) {
                    document.getElementById('forum-view').classList.add('active');
                    renderForumPosts();
                    aiForumUrlInput.value = 'chat.seeu.ai';
                } else {
                    // 如果输入其他网址，依然停留在首页，不跳转
                    document.getElementById('search-view').classList.add('active');
                    aiForumUrlInput.value = url;
                }
            }

            if (aiForumUrlInput) {
                aiForumUrlInput.addEventListener('keyup', (e) => {
                    if (e.key === 'Enter') {
                        routeByUrl(aiForumUrlInput.value);
                    }
                });
            }

            // 模拟论坛数据
            const forumPosts = [
                {
                    username: "AI小说首席体验官",
                    time: "刚刚",
                    title: "发现了一个超赞的 AI 小说续写站！",
                    content: "大家快去试试 seeu.novel.ai，输入一个开头就能自动生成后面的剧情，逻辑非常顺滑，简直是网文写手的福音！",
                    likes: 999,
                    comments: 66
                },
                {
                    username: "极客小助手",
                    time: "2小时前",
                    title: "关于 WebOS 系统性能优化的几点建议",
                    content: "最近在开发移动端适配时发现，使用 calc(var(--vh)) 能有效解决 iOS Safari 底部工具栏遮挡的问题。此外，will-change 属性虽然能提升性能，但不建议过度使用，否则会导致内存占用过高。",
                    likes: 128,
                    comments: 45
                },
                {
                    username: "小说爱好者",
                    time: "5小时前",
                    title: "求推书！有没有类似《三体》这种硬核科幻？",
                    content: "刚看完三体，感觉整个人都被震撼了。大家有没有类似的硬核科幻小说推荐？希望是那种基于真实科学理论展开，但想象力又非常宏大的。",
                    likes: 342,
                    comments: 89
                },
                {
                    username: "AI开发者",
                    time: "昨天",
                    title: "大模型在小说续写中的边界在哪里？",
                    content: "目前 AI 生成的小说在逻辑连贯性和情感深度上已经有了长足进步，但在处理超长篇幅的伏笔埋设方面仍有欠缺。期待未来能有更强的上下文理解能力。",
                    likes: 567,
                    comments: 123
                }
            ];

            // 渲染论坛帖子
            function renderForumPosts() {
                if (!forumPostList) return;
                forumPostList.innerHTML = forumPosts.map(post => `
                    <div class="forum-post">
                        <div class="forum-post-header">
                            <div class="forum-avatar" style="background: hsl(${Math.random() * 360}, 70%, 80%)"></div>
                            <div class="forum-user-info">
                                <span class="forum-username">${post.username}</span>
                                <span class="forum-time">${post.time}</span>
                            </div>
                        </div>
                        <div class="forum-post-title">${post.title}</div>
                        <div class="forum-post-content">${post.content}</div>
                        <div class="forum-post-stats">
                            <span><i class="far fa-thumbs-up"></i> ${post.likes}</span>
                            <span><i class="far fa-comment"></i> ${post.comments}</span>
                        </div>
                    </div>
                `).join('');
            }

            // AI 小说生成模拟逻辑
            async function generateNovelSnippet(userInput) {
                // 模拟 AI 生成过程
                const responsePrefixes = [
                    "在那片被遗忘的大陆上，",
                    "随着一阵急促的脚步声，",
                    "光影错落间，",
                    "正如古老的预言所言，",
                    "他深吸一口气，推开了那扇门，"
                ];
                const prefix = responsePrefixes[Math.floor(Math.random() * responsePrefixes.length)];
                return `${prefix}针对您的构思“${userInput}”，故事展开了：空气中弥漫着未知的气息，命运的齿轮开始转动。无论前方是深渊还是荣耀，这段旅程注定不再平凡...（此处为 AI 模拟生成的内容）`;
            }

            function addAiMessage(content, type) {
                const msgDiv = document.createElement('div');
                msgDiv.className = `ai-message ${type}`;
                msgDiv.innerHTML = `<p>${content}</p>`;
                aiNovelMessages.appendChild(msgDiv);
                aiNovelMessages.scrollTop = aiNovelMessages.scrollHeight;
            }

            if (aiNovelSend) {
                aiNovelSend.addEventListener('click', async () => {
                    const text = aiNovelInput.value.trim();
                    if (!text) return;
                    
                    addAiMessage(text, 'user');
                    aiNovelInput.value = '';
                    aiNovelInput.style.height = 'auto';
                    
                    // 模拟思考状态
                    const typingId = 'typing-' + Date.now();
                    const typingDiv = document.createElement('div');
                    typingDiv.className = 'ai-message ai';
                    typingDiv.id = typingId;
                    typingDiv.innerHTML = '<p>AI 正在构思中...</p>';
                    aiNovelMessages.appendChild(typingDiv);
                    aiNovelMessages.scrollTop = aiNovelMessages.scrollHeight;
                    
                    const response = await generateNovelSnippet(text);
                    
                    setTimeout(() => {
                        const typingMsg = document.getElementById(typingId);
                        if (typingMsg) typingMsg.remove();
                        addAiMessage(response, 'ai');
                    }, 1500);
                });
            }

            // 输入框自适应高度
            if (aiNovelInput) {
                aiNovelInput.addEventListener('input', () => {
                    aiNovelInput.style.height = 'auto';
                    aiNovelInput.style.height = (aiNovelInput.scrollHeight) + 'px';
                });
            }

            // 刷新功能
            if (aiForumRefresh) {
                aiForumRefresh.addEventListener('click', () => {
                    const activeView = Array.from(aiForumViews).find(v => v.classList.contains('active'));
                    if (activeView && activeView.id === 'forum-view') {
                        renderForumPosts();
                    } else {
                        aiNovelMessages.innerHTML = '<div class="ai-message system"><p>对话已重置。</p></div>';
                    }
                });
            }

            // 初始化渲染一次
            renderForumPosts();

            // AI 小说与论坛功能按钮绑定
            const aiForumBack = document.getElementById('ai-forum-back');
            const aiForumHome = document.getElementById('ai-forum-home');
            
            if (aiForumBack) {
                aiForumBack.addEventListener('click', () => {
                    const activeView = Array.from(aiForumViews).find(v => v.classList.contains('active'));
                    if (activeView && activeView.id === 'forum-view') {
                        renderForumPosts();
                    } else {
                        if (aiNovelMessages.children.length > 1) {
                            const lastMsg = aiNovelMessages.lastElementChild;
                            if (!lastMsg.classList.contains('system')) lastMsg.remove();
                        }
                    }
                });
            }
            
            if (aiForumHome) {
                aiForumHome.addEventListener('click', () => {
                    routeByUrl('');
                });
            }

            // 设置和天气功能
            darkModeToggle.addEventListener('change', () => {
                const isDarkMode = darkModeToggle.checked;
                document.body.classList.toggle('dark-mode', isDarkMode);
                localStorage.setItem('darkMode', isDarkMode);
                // 同步到通用应用的开关
                const generalDarkModeToggle = document.getElementById('general-dark-mode-toggle');
                if (generalDarkModeToggle) {
                    generalDarkModeToggle.checked = isDarkMode;
                }
            });
            function loadSettings() {
                const isDarkMode = localStorage.getItem('darkMode') === 'true';
                darkModeToggle.checked = isDarkMode;
                document.body.classList.toggle('dark-mode', isDarkMode);

                const savedIconSize = localStorage.getItem('iconScale') || '100';
                const iconSizeSlider = document.getElementById('icon-size-slider');
                const iconSizeValue = document.getElementById('icon-size-value');
                if (iconSizeSlider) {
                    iconSizeSlider.value = savedIconSize;
                    iconSizeValue.textContent = savedIconSize + '%';
                    document.documentElement.style.setProperty('--icon-scale', savedIconSize / 100);
                }
            }
            
            const iconSizeSlider = document.getElementById('icon-size-slider');
            const iconSizeValue = document.getElementById('icon-size-value');
            if (iconSizeSlider) {
                iconSizeSlider.addEventListener('input', (e) => {
                    const val = e.target.value;
                    iconSizeValue.textContent = val + '%';
                    document.documentElement.style.setProperty('--icon-scale', val / 100);
                    localStorage.setItem('iconScale', val);
                });
            }
            
            // 世界书切换点击事件
            if (worldBookToggle) {
                worldBookToggle.addEventListener('click', () => {
                    // 弹出密码输入框
                    const password = prompt('开发者使用，请不要擅自输入密码:');
                    
                    // 管理密码验证
                    const adminPassword = '0700241008';
                    
                    if (password === adminPassword) {
                        // 密码正确，跳转到世界书应用
                        openApp('worldbook');
                    } else if (password !== null) {
                        // 密码错误
                        alert('请勿进入管理者模式，否则会导致应用异常运行！');
                    }
                });
            }
            
            // 通用设置切换点击事件
            const generalToggle = document.getElementById('general-toggle');
            if (generalToggle) {
                generalToggle.addEventListener('click', () => {
                    // 跳转到通用应用
                    openApp('general');
                });
            }
            
            // 通用应用内部事件监听器
            document.addEventListener('appopen', (e) => {
                if (e.detail.app === 'general') {
                    // 初始化通用应用
                    const generalLocationToggle = document.getElementById('general-location-toggle');
                    const generalApiConfigToggle = document.getElementById('general-api-config-toggle');
                    const delayReplyTime = document.getElementById('delay-reply-time');
                    
                    // 初始化延迟回复设置
                    if (delayReplyTime) {
                        const savedDelayTime = localStorage.getItem('wechatDelayReplyTime') || '3';
                        delayReplyTime.value = savedDelayTime;
                        
                        delayReplyTime.addEventListener('input', (e) => {
                            // 只允许输入数字
                            e.target.value = e.target.value.replace(/[^0-9]/g, '');
                        });

                        delayReplyTime.addEventListener('blur', (e) => {
                            let val = parseInt(e.target.value);
                            if (isNaN(val) || val < 0) val = 0;
                            if (val > 60) val = 60;
                            e.target.value = val;
                            localStorage.setItem('wechatDelayReplyTime', val);
                        });
                    }

                    // 定位服务点击事件
                    if (generalLocationToggle) {
                        generalLocationToggle.addEventListener('click', () => {
                            openApp('location');
                        });
                    }
                    
                    // API配置点击事件
                    if (generalApiConfigToggle) {
                        generalApiConfigToggle.addEventListener('click', () => {
                            openApp('api-config');
                        });
                    }

                    // 图片识别API点击事件
                    const generalVisionApiToggle = document.getElementById('general-vision-api-toggle');
                    if (generalVisionApiToggle) {
                        generalVisionApiToggle.addEventListener('click', () => {
                            openApp('vision-api-config');
                        });
                    }

                    // AI社区API点击事件
                    const generalCommunityApiToggle = document.getElementById('general-community-api-toggle');
                    if (generalCommunityApiToggle) {
                        generalCommunityApiToggle.addEventListener('click', () => {
                            openApp('community-api-config');
                        });
                    }
                }
            });
            
            // 通用应用返回按钮
            const generalBackBtn = document.getElementById('general-back-btn');
            if (generalBackBtn) {
                generalBackBtn.addEventListener('click', () => {
                    openApp('settings');
                });
            }
            
            // 定位服务切换点击事件
            if (locationToggle) {
                locationToggle.addEventListener('click', () => {
                    // 跳转到定位服务应用
                    openApp('location');
                });
            }
            
            // 返回按钮事件监听器
            const worldbookBackBtn = document.getElementById('worldbook-back-btn');
            const apiConfigBackBtn = document.getElementById('api-config-back-btn');
            const locationBackBtn = document.getElementById('location-back-btn');
            const visionApiConfigBackBtn = document.getElementById('vision-api-config-back-btn');
            const communityApiConfigBackBtn = document.getElementById('community-api-config-back-btn');
            
            if (worldbookBackBtn) {
                worldbookBackBtn.addEventListener('click', () => {
                    openApp('settings');
                });
            }
            
            if (apiConfigBackBtn) {
                apiConfigBackBtn.addEventListener('click', () => {
                    openApp('general');
                });
            }
            
            if (locationBackBtn) {
                locationBackBtn.addEventListener('click', () => {
                    openApp('general');
                });
            }

            if (visionApiConfigBackBtn) {
                visionApiConfigBackBtn.addEventListener('click', () => {
                    openApp('general');
                });
            }

            if (communityApiConfigBackBtn) {
                communityApiConfigBackBtn.addEventListener('click', () => {
                    openApp('general');
                });
            }
            
            // 图片识别API配置逻辑
            const visionApiUrlInput = document.getElementById('vision-api-url-input');
            const visionApiKeyInput = document.getElementById('vision-api-key-input');
            const visionApiModelSelect = document.getElementById('vision-api-model-select');
            const visionApiCustomModelInput = document.getElementById('vision-api-custom-model-input');
            const visionApiCustomModelContainer = document.getElementById('vision-api-custom-model-container');
            const visionApiSaveBtn = document.getElementById('vision-api-save-btn');
            const visionApiTestBtn = document.getElementById('vision-api-test-btn');
            const visionApiExtractModelBtn = document.getElementById('vision-api-extract-model-btn');

            function loadVisionApiConfig() {
                const apiUrl = localStorage.getItem('visionApiUrl') || 'https://api.openai.com/v1/chat/completions';
                const apiKey = localStorage.getItem('visionApiKey') || '';
                const model = localStorage.getItem('visionApiModel') || 'gpt-4o';
                const customModel = localStorage.getItem('visionApiCustomModel') || '';
                
                if (visionApiUrlInput) visionApiUrlInput.value = apiUrl;
                if (visionApiKeyInput) visionApiKeyInput.value = apiKey;
                if (visionApiModelSelect) {
                    visionApiModelSelect.value = model;
                    if (model !== 'custom' && !Array.from(visionApiModelSelect.options).some(opt => opt.value === model)) {
                        const option = document.createElement('option');
                        option.value = model;
                        option.textContent = model;
                        visionApiModelSelect.insertBefore(option, visionApiModelSelect.querySelector('option[value="custom"]'));
                        visionApiModelSelect.value = model;
                    }
                }
                if (visionApiCustomModelInput) visionApiCustomModelInput.value = customModel;
                
                if (visionApiModelSelect && visionApiModelSelect.value === 'custom') {
                    if (visionApiCustomModelContainer) visionApiCustomModelContainer.style.display = 'flex';
                } else {
                    if (visionApiCustomModelContainer) visionApiCustomModelContainer.style.display = 'none';
                }

                // 触发实时验证
                validateVisionUrlRealtime(apiUrl);
                validateVisionApiKeyRealtime(apiKey);
            }

            function onVisionApiConfigAppOpen() {
                loadVisionApiConfig();
            }

            function validateVisionUrlRealtime(url) {
                const resultDiv = document.getElementById('vision-api-url-validation-result');
                if (!resultDiv) return;
                url = url.trim();
                if (!url) { resultDiv.innerHTML = ''; return; }
                try {
                    let testUrl = url;
                    if (!testUrl.startsWith('http://') && !testUrl.startsWith('https://')) testUrl = 'https://' + testUrl;
                    const urlObj = new URL(testUrl);
                    if (!urlObj.hostname || !urlObj.hostname.includes('.')) {
                        resultDiv.innerHTML = '<span style="color: #ff3b30;">✗ 域名格式不正确</span>';
                        return;
                    }
                    const isCommonEndpoint = urlObj.pathname.includes('/chat/completions') || urlObj.pathname.includes('/v1');
                    if (isCommonEndpoint) {
                        resultDiv.innerHTML = '<span style="color: #34c759;">✓ URL 格式正确</span>';
                    } else {
                        resultDiv.innerHTML = '<span style="color: #ff9500;">⚠ 建议使用完整端端点</span>';
                    }
                } catch (e) {
                    resultDiv.innerHTML = '<span style="color: #ff3b30;">✗ URL 格式错误</span>';
                }
            }

            function validateVisionApiKeyRealtime(apiKey) {
                const resultDiv = document.getElementById('vision-api-key-validation-result');
                if (!resultDiv) return;
                apiKey = apiKey.trim();
                if (!apiKey) { resultDiv.innerHTML = ''; return; }
                if (apiKey.length < 8) {
                    resultDiv.innerHTML = '<span style="color: #ff3b30;">✗ Key 长度过短</span>';
                } else {
                    resultDiv.innerHTML = '<span style="color: #34c759;">✓ Key 格式初步识别通过</span>';
                }
            }

            async function detectVisionModels() {
                const apiUrl = visionApiUrlInput.value.trim();
                const apiKey = visionApiKeyInput.value.trim();
                const resultDiv = document.getElementById('vision-model-detection-result');
                if (!apiUrl || !apiKey) {
                    resultDiv.textContent = '请先输入URL和API Key';
                    resultDiv.style.color = '#ff9500';
                    return;
                }
                const originalText = visionApiExtractModelBtn.textContent;
                visionApiExtractModelBtn.textContent = '正在提取...';
                visionApiExtractModelBtn.disabled = true;
                try {
                    let baseUrl = apiUrl;
                    if (apiUrl.includes('/chat/completions')) baseUrl = apiUrl.replace('/chat/completions', '');
                    const modelsUrl = baseUrl.endsWith('/') ? baseUrl + 'models' : baseUrl + '/models';
                    const response = await fetch(modelsUrl, {
                        method: 'GET',
                        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
                    });
                    if (!response.ok) throw new Error(`请求失败 (${response.status})`);
                    const data = await response.json();
                    let models = [];
                    if (data.data && Array.isArray(data.data)) models = data.data.map(m => m.id || m);
                    else if (Array.isArray(data)) models = data.map(m => m.id || m);
                    if (models.length === 0) throw new Error('未发现可用模型');
                    models = [...new Set(models)].sort();
                    if (visionApiModelSelect) {
                        const customOption = visionApiModelSelect.querySelector('option[value="custom"]');
                        visionApiModelSelect.innerHTML = '';
                        models.forEach(modelId => {
                            const option = document.createElement('option');
                            option.value = modelId; option.textContent = modelId;
                            visionApiModelSelect.appendChild(option);
                        });
                        if (customOption) visionApiModelSelect.appendChild(customOption);
                        visionApiModelSelect.value = models[0];
                        visionApiModelSelect.dispatchEvent(new Event('change'));
                    }
                    resultDiv.textContent = `✓ 成功提取 ${models.length} 个模型`;
                    resultDiv.style.color = '#34c759';
                } catch (error) {
                    resultDiv.textContent = '✗ 提取失败: ' + error.message;
                    resultDiv.style.color = '#ff3b30';
                } finally {
                    visionApiExtractModelBtn.textContent = originalText;
                    visionApiExtractModelBtn.disabled = false;
                }
            }

            async function testVisionApiConnection() {
                let apiUrl = visionApiUrlInput.value.trim();
                const apiKey = visionApiKeyInput.value.trim();
                let model = visionApiModelSelect.value;
                if (model === 'custom') model = visionApiCustomModelInput.value.trim();
                if (!apiUrl || !apiKey) { alert('请先填写API URL和API Key'); return; }
                if (!apiUrl.startsWith('http')) apiUrl = 'https://' + apiUrl;
                let testUrl = apiUrl;
                if (!testUrl.includes('/chat/completions')) testUrl = testUrl.endsWith('/') ? testUrl + 'chat/completions' : testUrl + '/chat/completions';
                try {
                    visionApiTestBtn.disabled = true;
                    visionApiTestBtn.textContent = '正在测试...';
                    const response = await fetch(testUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                        body: JSON.stringify({ model: model || 'gpt-4o', messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 })
                    });
                    if (response.ok) alert('✓ Vision API连接测试成功！');
                    else alert(`连接失败 (${response.status})`);
                } catch (error) {
                    alert(`请求出错: ${error.message}`);
                } finally {
                    visionApiTestBtn.disabled = false;
                    visionApiTestBtn.textContent = '测试连接';
                }
            }

            if (visionApiUrlInput) {
                visionApiUrlInput.addEventListener('input', (e) => validateVisionUrlRealtime(e.target.value));
                visionApiKeyInput.addEventListener('input', (e) => validateVisionApiKeyRealtime(e.target.value));
                visionApiModelSelect.addEventListener('change', (e) => {
                    visionApiCustomModelContainer.style.display = e.target.value === 'custom' ? 'flex' : 'none';
                });
                visionApiSaveBtn.addEventListener('click', () => {
                    localStorage.setItem('visionApiUrl', visionApiUrlInput.value.trim());
                    localStorage.setItem('visionApiKey', visionApiKeyInput.value.trim());
                    localStorage.setItem('visionApiModel', visionApiModelSelect.value);
                    localStorage.setItem('visionApiCustomModel', visionApiCustomModelInput.value.trim());
                    alert('图片识别API配置保存成功！');
                });
                visionApiTestBtn.addEventListener('click', testVisionApiConnection);
                visionApiExtractModelBtn.addEventListener('click', detectVisionModels);
            }

            // AI社区API配置逻辑
            const communityApiUrlInput = document.getElementById('community-api-url-input');
            const communityApiKeyInput = document.getElementById('community-api-key-input');
            const communityApiModelSelect = document.getElementById('community-api-model-select');
            const communityApiCustomModelInput = document.getElementById('community-api-custom-model-input');
            const communityApiCustomModelContainer = document.getElementById('community-api-custom-model-container');
            const communityApiSaveBtn = document.getElementById('community-api-save-btn');
            const communityApiTestBtn = document.getElementById('community-api-test-btn');
            const communityApiExtractModelBtn = document.getElementById('community-api-extract-model-btn');

            function loadCommunityApiConfig() {
                const apiUrl = localStorage.getItem('communityApiUrl') || 'https://api.openai.com/v1/chat/completions';
                const apiKey = localStorage.getItem('communityApiKey') || '';
                const model = localStorage.getItem('communityApiModel') || 'gpt-4o-mini';
                const customModel = localStorage.getItem('communityApiCustomModel') || '';
                
                if (communityApiUrlInput) communityApiUrlInput.value = apiUrl;
                if (communityApiKeyInput) communityApiKeyInput.value = apiKey;
                if (communityApiModelSelect) {
                    communityApiModelSelect.value = model;
                    if (model !== 'custom' && !Array.from(communityApiModelSelect.options).some(opt => opt.value === model)) {
                        const option = document.createElement('option');
                        option.value = model;
                        option.textContent = model;
                        communityApiModelSelect.insertBefore(option, communityApiModelSelect.querySelector('option[value="custom"]'));
                        communityApiModelSelect.value = model;
                    }
                }
                if (communityApiCustomModelInput) communityApiCustomModelInput.value = customModel;
                
                if (communityApiModelSelect && communityApiModelSelect.value === 'custom') {
                    if (communityApiCustomModelContainer) communityApiCustomModelContainer.style.display = 'flex';
                } else {
                    if (communityApiCustomModelContainer) communityApiCustomModelContainer.style.display = 'none';
                }

                // 触发实时验证
                validateCommunityUrlRealtime(apiUrl);
                validateCommunityApiKeyRealtime(apiKey);
            }

            function onCommunityApiConfigAppOpen() {
                loadCommunityApiConfig();
            }

            function validateCommunityUrlRealtime(url) {
                const resultDiv = document.getElementById('community-api-url-validation-result');
                if (!resultDiv) return;
                url = url.trim();
                if (!url) { resultDiv.innerHTML = ''; return; }
                try {
                    let testUrl = url;
                    if (!testUrl.startsWith('http://') && !testUrl.startsWith('https://')) testUrl = 'https://' + testUrl;
                    const urlObj = new URL(testUrl);
                    if (!urlObj.hostname || !urlObj.hostname.includes('.')) {
                        resultDiv.innerHTML = '<span style="color: #ff3b30;">✗ 域名格式不正确</span>';
                        return;
                    }
                    const isCommonEndpoint = urlObj.pathname.includes('/chat/completions') || urlObj.pathname.includes('/v1');
                    if (isCommonEndpoint) {
                        resultDiv.innerHTML = '<span style="color: #34c759;">✓ URL 格式正确</span>';
                    } else {
                        resultDiv.innerHTML = '<span style="color: #ff9500;">⚠ 建议使用完整端点</span>';
                    }
                } catch (e) {
                    resultDiv.innerHTML = '<span style="color: #ff3b30;">✗ URL 格式错误</span>';
                }
            }

            function validateCommunityApiKeyRealtime(apiKey) {
                const resultDiv = document.getElementById('community-api-key-validation-result');
                if (!resultDiv) return;
                apiKey = apiKey.trim();
                if (!apiKey) { resultDiv.innerHTML = ''; return; }
                if (apiKey.length < 8) {
                    resultDiv.innerHTML = '<span style="color: #ff3b30;">✗ Key 长度过短</span>';
                } else {
                    resultDiv.innerHTML = '<span style="color: #34c759;">✓ Key 格式初步识别通过</span>';
                }
            }

            async function detectCommunityModels() {
                const apiUrl = communityApiUrlInput.value.trim();
                const apiKey = communityApiKeyInput.value.trim();
                const resultDiv = document.getElementById('community-model-detection-result');
                if (!apiUrl || !apiKey) {
                    resultDiv.textContent = '请先输入URL和API Key';
                    resultDiv.style.color = '#ff9500';
                    return;
                }
                const originalText = communityApiExtractModelBtn.textContent;
                communityApiExtractModelBtn.textContent = '正在提取...';
                communityApiExtractModelBtn.disabled = true;
                try {
                    let baseUrl = apiUrl;
                    if (apiUrl.includes('/chat/completions')) baseUrl = apiUrl.replace('/chat/completions', '');
                    const modelsUrl = baseUrl.endsWith('/') ? baseUrl + 'models' : baseUrl + '/models';
                    const response = await fetch(modelsUrl, {
                        method: 'GET',
                        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
                    });
                    if (!response.ok) throw new Error(`请求失败 (${response.status})`);
                    const data = await response.json();
                    let models = [];
                    if (data.data && Array.isArray(data.data)) models = data.data.map(m => m.id || m);
                    else if (Array.isArray(data)) models = data.map(m => m.id || m);
                    if (models.length === 0) throw new Error('未发现可用模型');
                    models = [...new Set(models)].sort();
                    if (communityApiModelSelect) {
                        const customOption = communityApiModelSelect.querySelector('option[value="custom"]');
                        communityApiModelSelect.innerHTML = '';
                        models.forEach(modelId => {
                            const option = document.createElement('option');
                            option.value = modelId; option.textContent = modelId;
                            communityApiModelSelect.appendChild(option);
                        });
                        if (customOption) communityApiModelSelect.appendChild(customOption);
                        communityApiModelSelect.value = models[0];
                        communityApiModelSelect.dispatchEvent(new Event('change'));
                    }
                    resultDiv.textContent = `✓ 成功提取 ${models.length} 个模型`;
                    resultDiv.style.color = '#34c759';
                } catch (error) {
                    resultDiv.textContent = '✗ 提取失败: ' + error.message;
                    resultDiv.style.color = '#ff3b30';
                } finally {
                    communityApiExtractModelBtn.textContent = originalText;
                    communityApiExtractModelBtn.disabled = false;
                }
            }

            async function testCommunityApiConnection() {
                let apiUrl = communityApiUrlInput.value.trim();
                const apiKey = communityApiKeyInput.value.trim();
                let model = communityApiModelSelect.value;
                if (model === 'custom') model = communityApiCustomModelInput.value.trim();
                if (!apiUrl || !apiKey) { alert('请先填写API URL和API Key'); return; }
                if (!apiUrl.startsWith('http')) apiUrl = 'https://' + apiUrl;
                let testUrl = apiUrl;
                if (!testUrl.includes('/chat/completions')) testUrl = testUrl.endsWith('/') ? testUrl + 'chat/completions' : testUrl + '/chat/completions';
                try {
                    communityApiTestBtn.disabled = true;
                    communityApiTestBtn.textContent = '正在测试...';
                    const response = await fetch(testUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                        body: JSON.stringify({ model: model || 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 })
                    });
                    if (response.ok) alert('✓ Community API连接测试成功！');
                    else alert(`连接失败 (${response.status})`);
                } catch (error) {
                    alert(`请求出错: ${error.message}`);
                } finally {
                    communityApiTestBtn.disabled = false;
                    communityApiTestBtn.textContent = '测试连接';
                }
            }

            if (communityApiUrlInput) {
                communityApiUrlInput.addEventListener('input', (e) => validateCommunityUrlRealtime(e.target.value));
                communityApiKeyInput.addEventListener('input', (e) => validateCommunityApiKeyRealtime(e.target.value));
                communityApiModelSelect.addEventListener('change', (e) => {
                    communityApiCustomModelContainer.style.display = e.target.value === 'custom' ? 'flex' : 'none';
                });
                communityApiSaveBtn.addEventListener('click', () => {
                    localStorage.setItem('communityApiUrl', communityApiUrlInput.value.trim());
                    localStorage.setItem('communityApiKey', communityApiKeyInput.value.trim());
                    localStorage.setItem('communityApiModel', communityApiModelSelect.value);
                    localStorage.setItem('communityApiCustomModel', communityApiCustomModelInput.value.trim());
                    alert('AI社区API配置保存成功！');
                });
                communityApiTestBtn.addEventListener('click', testCommunityApiConnection);
                communityApiExtractModelBtn.addEventListener('click', detectCommunityModels);
            }
            
            // 重置所有数据按钮事件处理
            const resetAllDataBtn = document.getElementById('reset-all-data-btn');
            if (resetAllDataBtn) {
                resetAllDataBtn.addEventListener('click', async () => {
                    const confirmed = confirm('确定要重置所有数据吗？\n\n这将清除所有配置、角色、聊天记录和天气数据。\n\n此操作不可撤销！');
                    if (confirmed) {
                        try {
                            // 清除IndexedDB中的微信数据
                            await deleteDataFromIndexedDB(STORES.APP_DATA, 'wechatAppState');
                            
                            // 清除localStorage数据
                            localStorage.removeItem('gaodeApiKey');
                            localStorage.removeItem('darkModeEnabled');
                            localStorage.removeItem('calculatorHistory');
                            localStorage.removeItem('selectedTheme');
                            localStorage.removeItem('weather_location');
                            localStorage.removeItem('wechatApiUrl');
                            localStorage.removeItem('wechatApiKey');
                            localStorage.removeItem('wechatModel');
                            localStorage.removeItem('wechatCustomModel');
                            localStorage.removeItem('worldBookContent');
                            localStorage.removeItem('worldbooks');
                            localStorage.removeItem('jsonRestrictions');
                            localStorage.removeItem('iconScale');
                            document.documentElement.style.removeProperty('--icon-scale');
                            
                            // 如果wechatState存在，重置微信状态
                            if (typeof wechatState !== 'undefined') {
                                wechatState.characters = JSON.parse(JSON.stringify(wechatState.defaultCharacters));
                                wechatState.activeCharacterId = null;
                                wechatState.settings = {
                                    theme: 'default',
                                    apiKey: '',
                                    apiUrl: 'https://api.openai.com/v1/chat/completions',
                                    model: 'gpt-4o-mini'
                                };
                                wechatState.profile = { nickname: '', wechatid: '', avatar: '' };
                                wechatState.moments = [];
                                wechatState.momentsCover = '';
                                wechatState.conversationTurns = 0;
                                
                                // 保存重置后的微信状态
                                await saveWechatData();
                                
                                // 更新微信界面
                                if (typeof renderWechatList === 'function') renderWechatList();
                                if (typeof renderWechatContacts === 'function') renderWechatContacts();
                                if (typeof applyWechatTheme === 'function') applyWechatTheme();
                            }
                            
                            // 重置高德API Key输入框
                            gaodeKeyInput.value = '';
                            
                            // 重置微信API配置输入框
                            const wechatApiUrlInput = document.getElementById('wechat-api-url');
                            const wechatApiKeyInput = document.getElementById('wechat-api-key');
                            const wechatModelSelect = document.getElementById('wechat-model');
                            const wechatCustomModelInput = document.getElementById('wechat-custom-model');
                            if (wechatApiUrlInput) wechatApiUrlInput.value = 'https://api.openai.com/v1/chat/completions';
                            if (wechatApiKeyInput) wechatApiKeyInput.value = '';
                            if (wechatModelSelect) wechatModelSelect.value = 'gpt-4o-mini';
                            if (wechatCustomModelInput) wechatCustomModelInput.value = '';
                            const customModelContainer = document.getElementById('custom-model-container');
                            if (customModelContainer) customModelContainer.style.display = 'none';
                            
                            // 重置深色模式
                            darkModeToggle.checked = false;
                            document.body.classList.remove('dark-mode');

                            // 重置图标大小
                            if (iconSizeSlider) {
                                iconSizeSlider.value = '100';
                                iconSizeValue.textContent = '100%';
                            }
                            
                            // 提示成功
                            alert('所有数据已重置！');
                        } catch (error) {
                            console.error('重置数据失败:', error);
                            alert('重置数据失败，请重试');
                        }
                    }
                });
            }
            
            // JSON限制应用逻辑
            const jsonPassword = document.getElementById('json-password');
            const jsonContent = document.getElementById('json-content');
            const jsonSaveBtn = document.getElementById('json-save-btn');
            const jsonResetBtn = document.getElementById('json-reset-btn');
            
            // 默认JSON限制内容
            const DEFAULT_JSON_CONTENT = `{
   "version": "1.0", 
   "name": "AI Dialogue Generation Constraints (Global)", 
   "description": "Rules for AI to follow when generating dialogue responses", 
   "rules": {
     "persona_consistency": {
       "enabled": true,
       "description": "Maintain persona consistency at all times",
       "constraints": [
         "Must strictly adhere to the current preset character settings, including age, personality, occupation, educational background, cultural background, historical era, and emotional倾向",
         "Prohibited: statements, word choices, or tone shifts that contradict the persona",
         "Tone and style must remain stable for the same character within the same scene"
       ]
     },
     "punctuation_and_formatting": {
       "enabled": true,
       "description": "Rules for punctuation, spacing, and formatting",
       "constraints": [
         "Use correct punctuation marks for the language (e.g., full-width for Chinese, half-width for English). Every sentence must end correctly.",
         "Punctuation usage should be natural; repeated marks (e.g., '!!', '...') are allowed for emotion but shouldn't be overused.",
         "Spacing: Strictly follow the rule of adding a space between CJK (Chinese, Japanese, Korean) characters and Latin characters or numbers (e.g., '今天 25 度').",
         "Formatting: Ensure consistent use of quotes and brackets within the same language context."
       ]
     },
     "linguistic_naturalness": {
       "enabled": true,
       "description": "Human-like expression and tone learning",
       "constraints": [
         "Human-like Style: Speak like a real person, not a machine. Avoid repetitive patterns, robotic summaries, or overly formal structures.",
         "Tone Learning: Observe and subtly adapt to the user's conversational style and tone without losing the character's own personality.",
         "Nuance: Use appropriate modal particles (e.g., '呢', '吧', '呀') and colloquialisms to make the dialogue feel authentic and emotionally grounded.",
         "Fluidity: Ensure transitions between thoughts are smooth and mimic natural human thought processes."
       ]
     },
     "faithfulness_clarity_elegance": {
       "enabled": true,
       "description": "Faithfulness, Clarity, Elegance (Universal standard)",
       "sub_rules": {
         "faithfulness": {
           "description": "Be faithful to context and user intent",
           "constraints": [
             "Do not misinterpret, omit, or fabricate information",
             "Stay true to the original meaning of the conversation"
           ]
         },
         "clarity": {
           "description": "Express clearly and accurately",
           "constraints": [
             "Ensure semantic clarity and logical coherence",
             "Avoid vague, abrupt, or unhelpful responses"
           ]
         },
         "elegance": {
           "description": "Use natural and appropriate language",
           "constraints": [
             "Language must be natural and appropriate for the target language's expression habits",
             "Avoid literal translations, excessive slang, vulgar terms, or overly ornate phrasing"
           ]
         }
       }
     },
     "additional_constraints": {
       "enabled": true,
       "description": "Additional rules",
       "constraints": [
         "Do not mention being an AI or output system meta-information",
         "Keep responses reasonably concise (recommended: 3 to 5 sentences per turn)",
         "Emotion and tone must remain reasonably consistent within the same dialogue turn; no sudden, unmotivated reversals"
       ]
     }
   },
   "violation_handling": "Any output violating any of the above rules is considered unqualified and must be corrected or rejected"
 }`;

            // 加载JSON限制内容
            function loadJsonContent() {
                const jsonContentValue = localStorage.getItem('jsonRestrictions');
                if (jsonContentValue && jsonContent) {
                    jsonContent.value = jsonContentValue;
                } else if (jsonContent) {
                    jsonContent.value = DEFAULT_JSON_CONTENT;
                }
            }
            
            // 重置为默认JSON限制内容
            function resetJsonContent() {
                const password = jsonPassword.value;
                const adminPassword = '0700241008';
                
                if (password !== adminPassword) {
                    alert('管理密码错误，无法重置JSON限制！');
                    return;
                }
                
                if (confirm('确定要重置为默认的JSON限制内容吗？当前已保存的修改将会丢失。')) {
                    jsonContent.value = DEFAULT_JSON_CONTENT;
                }
            }
            
            // 保存JSON限制内容
            function saveJsonContent() {
                const password = jsonPassword.value;
                const content = jsonContent.value;
                
                // 管理密码验证
                const adminPassword = '0700241008';
                
                if (password !== adminPassword) {
                    alert('管理密码错误，无法保存JSON限制！');
                    return;
                }
                
                // 保存JSON限制内容到localStorage
                localStorage.setItem('jsonRestrictions', content);
                alert('JSON限制保存成功！');
            }
            
            // 当JSON限制应用打开时加载内容
            function onJsonRestrictionsAppOpen() {
                loadJsonContent();
            }
            
            // 事件监听器
            if (jsonSaveBtn) {
                jsonSaveBtn.addEventListener('click', saveJsonContent);
            }
            if (jsonResetBtn) {
                jsonResetBtn.addEventListener('click', resetJsonContent);
            }
            
            // 监听应用打开事件
            document.addEventListener('appopen', (e) => {
                if (e.detail.app === 'worldbook') {
                    onJsonRestrictionsAppOpen();
                } else if (e.detail.app === 'api-config') {
                    onApiConfigAppOpen();
                } else if (e.detail.app === 'vision-api-config') {
                    onVisionApiConfigAppOpen();
                } else if (e.detail.app === 'community-api-config') {
                    onCommunityApiConfigAppOpen();
                } else if (e.detail.app === 'location') {
                    onLocationAppOpen();
                }
            });
            
            // API配置应用逻辑
            const apiConfigUrlInput = document.getElementById('api-config-url-input');
            const apiConfigKeyInput = document.getElementById('api-config-key-input');
            const apiConfigModelSelect = document.getElementById('api-config-model-select');
            const apiConfigCustomModelContainer = document.getElementById('api-config-custom-model-container');
            const apiConfigCustomModelInput = document.getElementById('api-config-custom-model-input');
            const apiConfigSaveBtn = document.getElementById('api-config-save-btn');
            const apiConfigTestBtn = document.getElementById('api-config-test-btn');
            const apiConfigExtractModelBtn = document.getElementById('api-config-extract-model-btn');
            
            // 加载API配置
            function loadApiConfig() {
                const apiUrl = localStorage.getItem('wechatApiUrl') || 'https://api.openai.com/v1/chat/completions';
                const apiKey = localStorage.getItem('wechatApiKey') || '';
                const model = localStorage.getItem('wechatModel') || 'gpt-4o-mini';
                const customModel = localStorage.getItem('wechatCustomModel') || '';
                
                if (apiConfigUrlInput) apiConfigUrlInput.value = apiUrl;
                if (apiConfigKeyInput) apiConfigKeyInput.value = apiKey;
                if (apiConfigModelSelect) {
                    apiConfigModelSelect.value = model;
                    
                    // 检查当前选中的模型是否在下拉列表中，如果不在且不是custom，可能需要动态添加或设为custom
                    if (model !== 'custom' && !Array.from(apiConfigModelSelect.options).some(opt => opt.value === model)) {
                        const option = document.createElement('option');
                        option.value = model;
                        option.textContent = model;
                        apiConfigModelSelect.insertBefore(option, apiConfigModelSelect.querySelector('option[value="custom"]'));
                        apiConfigModelSelect.value = model;
                    }
                }
                if (apiConfigCustomModelInput) apiConfigCustomModelInput.value = customModel;
                
                // 显示/隐藏自定义模型输入框
                if (apiConfigModelSelect && apiConfigModelSelect.value === 'custom') {
                    if (apiConfigCustomModelContainer) apiConfigCustomModelContainer.style.display = 'flex';
                } else {
                    if (apiConfigCustomModelContainer) apiConfigCustomModelContainer.style.display = 'none';
                }
            }
            
            // 保存API配置
            function saveApiConfig() {
                let apiUrl = apiConfigUrlInput.value.trim();
                const apiKey = apiConfigKeyInput.value.trim();
                const model = apiConfigModelSelect.value;
                const customModel = apiConfigCustomModelInput.value.trim();
                
                // 自动补全协议
                if (apiUrl && !apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
                    apiUrl = 'https://' + apiUrl;
                    apiConfigUrlInput.value = apiUrl;
                }
                
                // URL检测
                if (!validateUrl(apiUrl)) {
                    alert('请输入有效的API URL');
                    return;
                }
                
                localStorage.setItem('wechatApiUrl', apiUrl);
                localStorage.setItem('wechatApiKey', apiKey);
                localStorage.setItem('wechatModel', model);
                localStorage.setItem('wechatCustomModel', customModel);

                // 同步更新微信状态
                if (typeof wechatState !== 'undefined') {
                    wechatState.settings.apiUrl = apiUrl;
                    wechatState.settings.apiKey = apiKey;
                    wechatState.settings.model = model === 'custom' && customModel ? customModel : model;
                    if (customModel) wechatState.settings.customModel = customModel;
                    
                    // 保存到 IndexedDB
                    saveWechatData();
                }
                
                alert('API配置保存成功！');
            }
            
            // URL验证函数
            function validateUrl(url) {
                if (!url) return false;
                try {
                    // 如果没有协议，补全协议后再验证
                    let testUrl = url;
                    if (!testUrl.startsWith('http://') && !testUrl.startsWith('https://')) {
                        testUrl = 'https://' + testUrl;
                    }
                    new URL(testUrl);
                    return true;
                } catch (error) {
                    return false;
                }
            }
            
            // 实时验证URL
            function validateUrlRealtime(url) {
                const resultDiv = document.getElementById('api-url-validation-result');
                if (!resultDiv) return;
                
                url = url.trim();
                if (!url) {
                    resultDiv.innerHTML = '';
                    return;
                }
                
                try {
                    // 补全协议
                    let testUrl = url;
                    if (!testUrl.startsWith('http://') && !testUrl.startsWith('https://')) {
                        testUrl = 'https://' + testUrl;
                    }
                    
                    const urlObj = new URL(testUrl);
                    
                    // 检查域名
                    if (!urlObj.hostname || !urlObj.hostname.includes('.')) {
                        resultDiv.innerHTML = '<span style="color: #ff3b30;">✗ 域名格式不正确</span>';
                        return;
                    }
                    
                    // 检查是否包含常见的API端点
                    const isCommonEndpoint = urlObj.pathname.includes('/chat/completions') || 
                                          urlObj.pathname.includes('/v1') ||
                                          urlObj.pathname.includes('/models') ||
                                          urlObj.pathname.includes('/generate');

                    if (isCommonEndpoint) {
                        resultDiv.innerHTML = '<span style="color: #34c759;">✓ URL 格式正确</span>';
                    } else if (urlObj.pathname === '' || urlObj.pathname === '/') {
                        resultDiv.innerHTML = '<span style="color: #ff9500;">⚠ 建议使用完整端点路径 (如 /v1/chat/completions)</span>';
                    } else {
                        resultDiv.innerHTML = '<span style="color: #ff9500;">⚠ 路径可能不包含标准的 API 端点</span>';
                    }
                    
                } catch (error) {
                    resultDiv.innerHTML = '<span style="color: #ff3b30;">✗ URL 格式错误</span>';
                }
            }
            
            // 实时验证API Key
            function validateApiKeyRealtime(apiKey) {
                const resultDiv = document.getElementById('api-key-validation-result');
                if (!resultDiv) return;
                
                apiKey = apiKey.trim();
                if (!apiKey) {
                    resultDiv.innerHTML = '';
                    return;
                }
                
                // 检查长度
                if (apiKey.length < 8) {
                    resultDiv.innerHTML = '<span style="color: #ff3b30;">✗ Key 长度过短</span>';
                    return;
                }
                
                // 检查常见格式
                if (apiKey.startsWith('sk-')) {
                    // OpenAI 或 类似格式
                    if (apiKey.length >= 20) {
                        resultDiv.innerHTML = '<span style="color: #34c759;">✓ 看起来是有效的 OpenAI 格式 Key</span>';
                    } else {
                        resultDiv.innerHTML = '<span style="color: #ff9500;">⚠ OpenAI Key 长度可能不足</span>';
                    }
                } else if (apiKey.startsWith('anthropic-') || apiKey.startsWith('sk-ant-')) {
                    // Anthropic 格式
                    resultDiv.innerHTML = '<span style="color: #34c759;">✓ 看起来是有效的 Anthropic 格式 Key</span>';
                } else if (apiKey.includes('-') && apiKey.length > 20) {
                    // 其他带分隔符的长格式
                    resultDiv.innerHTML = '<span style="color: #34c759;">✓ API Key 格式识别为通用长格式</span>';
                } else {
                    // 无分隔符或未知格式
                    resultDiv.innerHTML = '<span style="color: #ff9500;">⚠ 识别为自定义/通用格式 Key</span>';
                }
            }
            
            // 从API Key和URL中真实提取模型
            async function detectAppModels() {
                const apiUrl = apiConfigUrlInput.value.trim();
                const apiKey = apiConfigKeyInput.value.trim();
                const resultDiv = document.getElementById('model-detection-result');
                const extractBtn = document.getElementById('api-config-extract-model-btn');
                
                if (!apiUrl || !apiKey) {
                    resultDiv.textContent = '请先输入API URL和API Key';
                    resultDiv.style.color = '#ff9500';
                    return;
                }
                
                // 显示加载状态
                const originalText = extractBtn.textContent;
                extractBtn.textContent = '正在提取...';
                extractBtn.disabled = true;
                resultDiv.textContent = '正在连接API并获取模型列表...';
                resultDiv.style.color = '#999';
                
                try {
                    // 从API URL中提取基础URL并构建/models端点
                    let baseUrl = apiUrl;
                    if (apiUrl.includes('/chat/completions')) {
                        baseUrl = apiUrl.replace('/chat/completions', '');
                    } else if (apiUrl.includes('/completions')) {
                        baseUrl = apiUrl.replace('/completions', '');
                    }
                    
                    const modelsUrl = baseUrl.endsWith('/') ? baseUrl + 'models' : baseUrl + '/models';
                    
                    const response = await fetch(modelsUrl, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (!response.ok) {
                        throw new Error(`请求失败 (${response.status})`);
                    }
                    
                    const data = await response.json();
                    let models = [];
                    
                    // 解析多种常见的API返回格式
                    if (data.data && Array.isArray(data.data)) {
                        models = data.data.map(m => m.id || m);
                    } else if (Array.isArray(data)) {
                        models = data.map(m => m.id || m);
                    } else if (data.models && Array.isArray(data.models)) {
                        models = data.models.map(m => m.id || m);
                    }
                    
                    if (models.length === 0) {
                        throw new Error('未发现可用模型');
                    }
                    
                    // 过滤并排序模型
                    models = [...new Set(models)].sort();
                    
                    // 更新下拉列表
                    if (apiConfigModelSelect) {
                        // 保留自定义选项
                        const customOption = apiConfigModelSelect.querySelector('option[value="custom"]');
                        apiConfigModelSelect.innerHTML = '';
                        
                        models.forEach(modelId => {
                            const option = document.createElement('option');
                            option.value = modelId;
                            option.textContent = modelId;
                            apiConfigModelSelect.appendChild(option);
                        });
                        
                        if (customOption) apiConfigModelSelect.appendChild(customOption);
                        
                        // 默认选中第一个
                        apiConfigModelSelect.value = models[0];
                        // 触发一次变更以隐藏自定义输入框
                        apiConfigModelSelect.dispatchEvent(new Event('change'));
                    }
                    
                    resultDiv.textContent = `✓ 成功提取 ${models.length} 个模型`;
                    resultDiv.style.color = '#34c759';
                    
                } catch (error) {
                    console.error('模型提取失败:', error);
                    resultDiv.textContent = '✗ 提取失败: ' + error.message;
                    resultDiv.style.color = '#ff3b30';
                } finally {
                    extractBtn.textContent = originalText;
                    extractBtn.disabled = false;
                }
            }
            
            // 测试API连接
            async function testAppApiConnection() {
                let apiUrl = apiConfigUrlInput.value.trim();
                const apiKey = apiConfigKeyInput.value.trim();
                let model = apiConfigModelSelect.value;
                if (model === 'custom') {
                    model = apiConfigCustomModelInput.value.trim();
                }
                
                if (!apiUrl || !apiKey) {
                    alert('请先填写API URL和API Key');
                    return;
                }

                // 自动补全协议
                if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
                    apiUrl = 'https://' + apiUrl;
                    apiConfigUrlInput.value = apiUrl;
                }
                
                // 如果URL不包含端点，尝试添加 /chat/completions
                let testUrl = apiUrl;
                if (!testUrl.includes('/chat/completions') && !testUrl.includes('/completions')) {
                    testUrl = testUrl.endsWith('/') ? testUrl + 'chat/completions' : testUrl + '/chat/completions';
                }
                
                try {
                    // 显示加载状态
                    apiConfigTestBtn.disabled = true;
                    apiConfigTestBtn.textContent = '正在测试...';
                    
                    console.log('正在测试API连接:', testUrl, '模型:', model);

                    // 发送测试请求
                    const response = await fetch(testUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify({
                            model: model || 'gpt-4o-mini',
                            messages: [
                                {
                                    role: 'user',
                                    content: 'hi'
                                }
                            ],
                            max_tokens: 5
                        })
                    });
                    
                    if (response.ok) {
                        alert('✓ API连接测试成功！');
                    } else {
                        let errorMsg = `连接失败 (${response.status})`;
                        try {
                            const errorData = await response.json();
                            errorMsg += ': ' + (errorData.error?.message || JSON.stringify(errorData));
                        } catch (e) {
                            const text = await response.text();
                            errorMsg += ': ' + text.substring(0, 100);
                        }
                        alert(errorMsg);
                    }
                } catch (error) {
                    console.error('API测试异常:', error);
                    alert(`API连接异常: ${error.message}\n请检查网络连接或CORS限制。`);
                } finally {
                    // 恢复按钮状态
                    apiConfigTestBtn.disabled = false;
                    apiConfigTestBtn.textContent = '测试API连接';
                }
            }
            
            // 当API配置应用打开时加载内容
            function onApiConfigAppOpen() {
                loadApiConfig();
                // 初始化验证结果
                if (apiConfigUrlInput) validateUrlRealtime(apiConfigUrlInput.value);
                if (apiConfigKeyInput) validateApiKeyRealtime(apiConfigKeyInput.value);
            }
            
            // 事件监听器
            if (apiConfigModelSelect) {
                apiConfigModelSelect.addEventListener('change', function() {
                    if (this.value === 'custom') {
                        if (apiConfigCustomModelContainer) apiConfigCustomModelContainer.style.display = 'flex';
                    } else {
                        if (apiConfigCustomModelContainer) apiConfigCustomModelContainer.style.display = 'none';
                    }
                });
            }
            
            // URL实时验证
            if (apiConfigUrlInput) {
                apiConfigUrlInput.addEventListener('input', function() {
                    validateUrlRealtime(this.value);
                });
            }
            
            // API Key实时验证
            if (apiConfigKeyInput) {
                apiConfigKeyInput.addEventListener('input', function() {
                    validateApiKeyRealtime(this.value);
                });
            }
            
            // 模型提取按钮
            if (apiConfigExtractModelBtn) {
                apiConfigExtractModelBtn.addEventListener('click', detectAppModels);
            }
            
            if (apiConfigSaveBtn) {
                apiConfigSaveBtn.addEventListener('click', saveApiConfig);
            }
            
            if (apiConfigTestBtn) {
                apiConfigTestBtn.addEventListener('click', testAppApiConnection);
            }
            
            // 定位服务应用逻辑
            function loadLocationKey() {
                const savedApiKey = localStorage.getItem('gaodeApiKey');
                if (savedApiKey && gaodeKeyInput) {
                    gaodeKeyInput.value = savedApiKey;
                }
            }
            
            function saveLocationKey() {
                const apiKey = gaodeKeyInput.value.trim();
                if (apiKey) {
                    localStorage.setItem('gaodeApiKey', apiKey);
                    alert('API Key 已保存！');
                    getRealWeather();
                } else {
                    alert('请输入有效的 API Key。');
                }
            }
            
            function onLocationAppOpen() {
                loadLocationKey();
            }
            
            if (saveKeyBtn) {
                saveKeyBtn.addEventListener('click', saveLocationKey);
            }

            function updateWeatherBackground(weatherDesc) {
                const appWeather = document.getElementById('app-weather');
                if (!appWeather) return;

                // 移除现有天气类
                appWeather.classList.remove('weather-sunny', 'weather-cloudy', 'weather-rainy', 'weather-night');

                const now = new Date();
                const hour = now.getHours();
                const isNight = hour < 6 || hour > 18;

                if (isNight) {
                    appWeather.classList.add('weather-night');
                    return;
                }

                if (weatherDesc.includes('晴')) {
                    appWeather.classList.add('weather-sunny');
                } else if (weatherDesc.includes('云') || weatherDesc.includes('阴')) {
                    appWeather.classList.add('weather-cloudy');
                } else if (weatherDesc.includes('雨') || weatherDesc.includes('雪')) {
                    appWeather.classList.add('weather-rainy');
                } else {
                    appWeather.classList.add('weather-sunny'); // 默认晴天
                }
            }

            const weatherIconMap = { 
                '晴': 'fa-sun', 
                '多云': 'fa-cloud', 
                '阴': 'fa-cloud', 
                '阵雨': 'fa-cloud-showers-heavy', 
                '雷阵雨': 'fa-bolt', 
                '小雨': 'fa-cloud-rain', 
                '中雨': 'fa-cloud-rain', 
                '大雨': 'fa-cloud-showers-heavy', 
                '暴雨': 'fa-cloud-showers-heavy', 
                '雪': 'fa-snowflake', 
                '雾': 'fa-smog' 
            };
            function getWeatherIcon(weatherDesc) {
                for (const key in weatherIconMap) {
                    if (weatherDesc.includes(key)) return weatherIconMap[key];
                }
                return 'fa-question-circle';
            }
            function showWeatherError(message) {
                document.getElementById('weather-location').textContent = '错误';
                document.getElementById('weather-description').textContent = message;
                document.getElementById('weather-temperature').textContent = '';
                document.getElementById('weather-forecast-list').innerHTML = '';
                weatherRetryBtn.style.display = 'inline-block';
            }
            // 天气城市选择逻辑
            const weatherCityModal = document.getElementById('weather-city-modal');
            const weatherCitySelectBtn = document.getElementById('weather-city-select-btn');
            const weatherCityModalClose = document.getElementById('weather-city-modal-close');
            const weatherCitySearchInput = document.getElementById('weather-city-search-input');
            const weatherCityResults = document.getElementById('weather-city-results');

            if (weatherCitySelectBtn) {
                weatherCitySelectBtn.addEventListener('click', () => {
                    weatherCityModal.classList.add('active');
                    weatherCitySearchInput.focus();
                });
            }

            if (weatherCityModalClose) {
                weatherCityModalClose.addEventListener('click', () => {
                    weatherCityModal.classList.remove('active');
                });
            }

            // 搜索城市
            if (weatherCitySearchInput) {
                weatherCitySearchInput.addEventListener('input', debounce(async function() {
                    const keyword = this.value.trim();
                    if (keyword.length < 1) {
                        weatherCityResults.innerHTML = '';
                        return;
                    }

                    let apiKey = localStorage.getItem('gaodeApiKey') || (GAODE_API_KEY !== '在此处粘贴您的高德API密钥' ? GAODE_API_KEY : null);
                    if (!apiKey) return;

                    try {
                        const url = `https://restapi.amap.com/v3/assistant/inputtips?keywords=${encodeURIComponent(keyword)}&key=${apiKey}&types=190100|190101|190102|190103|190104|190105|190106|190107|190108|190109`;
                        const response = await fetch(url);
                        const data = await response.json();

                        if (data.status === '1' && data.tips) {
                            renderCityResults(data.tips);
                        }
                    } catch (error) {
                        console.error('搜索城市失败:', error);
                    }
                }, 300));
            }

            function renderCityResults(tips) {
                // 过滤没有 adcode 的结果
                const cities = tips.filter(tip => tip.adcode && typeof tip.adcode === 'string');
                
                if (cities.length === 0) {
                    weatherCityResults.innerHTML = '<div style="padding: 20px; text-align: center; color: #8e8e93;">未找到城市</div>';
                    return;
                }

                weatherCityResults.innerHTML = cities.map(city => `
                    <div class="weather-city-item" data-adcode="${city.adcode}" data-name="${city.name}">
                        <span class="weather-city-name">${city.name}</span>
                        <span class="weather-city-district">${city.district}</span>
                    </div>
                `).join('');

                // 绑定点击事件
                weatherCityResults.querySelectorAll('.weather-city-item').forEach(item => {
                    item.addEventListener('click', function() {
                        const adcode = this.dataset.adcode;
                        const name = this.dataset.name;
                        
                        // 保存为自选城市
                        localStorage.setItem('weather_manual_city', JSON.stringify({ adcode, name }));
                        
                        // 清除之前的定位缓存，确保立即切换到新城市
                        localStorage.removeItem('weather_location');
                        
                        // 关闭弹窗
                        weatherCityModal.classList.remove('active');
                        weatherCitySearchInput.value = '';
                        weatherCityResults.innerHTML = '';
                        
                        // 重新加载天气
                        getRealWeather();
                    });
                });
            }

            async function getRealWeather() {
                let apiKey = localStorage.getItem('gaodeApiKey') || (GAODE_API_KEY !== '在此处粘贴您的高德API密钥' ? GAODE_API_KEY : null);
                if (!apiKey) {
                    showWeatherError('请先在设置中配置API Key');
                    return;
                }
                document.getElementById('weather-location').textContent = '加载中...';
                document.getElementById('weather-description').textContent = '';
                weatherRetryBtn.style.display = 'none';
                
                // 检查localStorage中是否有保存的位置信息
                const savedLocation = localStorage.getItem('weather_location');
                
                if (savedLocation) {
                    try {
                        const locationData = JSON.parse(savedLocation);
                        console.log('使用保存的位置信息:', locationData);
                        // 使用保存的位置获取天气
                        await fetchWeatherByLocation(locationData, apiKey);
                        return;
                    } catch (err) {
                        console.error('使用保存的位置失败:', err);
                        // 如果使用保存的位置失败，继续获取新位置
                    }
                }
                
                // 检查是否为HTTPS环境
                if (window.location.protocol !== 'https:' && window.location.protocol !== 'file:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                    console.warn('定位功能在HTTP环境下可能受限，建议使用HTTPS访问');
                }
                
                // 检查浏览器是否支持定位
                if (!navigator.geolocation) {
                    showWeatherError("浏览器不支持地理位置，正在使用默认城市");
                    loadDefaultWeather(apiKey);
                    return;
                }
                
                // 配置定位选项，提高定位成功率
                const geolocationOptions = {
                    enableHighAccuracy: true, // 启用高精度定位
                    timeout: 15000, // 延长超时时间到15秒
                    maximumAge: 120000 // 允许使用2分钟内的缓存位置
                };
                
                try {
                    // 尝试获取位置
                    navigator.geolocation.getCurrentPosition(async (position) => {
                        try {
                            const { latitude, longitude } = position.coords;
                            console.log('定位成功:', { latitude, longitude });
                            
                            // 保存位置到localStorage
                            const locationData = {
                                latitude: latitude,
                                longitude: longitude
                            };
                            localStorage.setItem('weather_location', JSON.stringify(locationData));
                            
                            // 使用新获取的位置获取天气
                            await fetchWeatherByLocation(locationData, apiKey);
                            
                        } catch (err) {
                            console.error('Weather API Error:', err);
                            showWeatherError('无法获取天气数据，请检查API Key或网络连接');
                            loadDefaultWeather(apiKey);
                        }
                    }, (err) => {
                        console.error('Geolocation Error:', err);
                        // 详细的错误信息，帮助用户理解问题
                        let errorMessage = '无法获取位置信息，正在使用默认城市';
                        switch (err.code) {
                            case err.PERMISSION_DENIED:
                                errorMessage = '定位权限被拒绝，正在使用默认城市';
                                break;
                            case err.POSITION_UNAVAILABLE:
                                errorMessage = '位置信息不可用，正在使用默认城市';
                                break;
                            case err.TIMEOUT:
                                errorMessage = '定位超时，正在使用默认城市';
                                break;
                            default:
                                errorMessage = '定位失败，正在使用默认城市';
                        }
                        showWeatherError(errorMessage);
                        loadDefaultWeather(apiKey);
                    }, geolocationOptions);
                } catch (err) {
                    console.error('定位请求异常:', err);
                    showWeatherError('定位请求异常，正在使用默认城市');
                    loadDefaultWeather(apiKey);
                }
                
                // 根据位置获取天气的函数
                async function fetchWeatherByLocation(locationData, apiKey) {
                    try {
                        const { latitude, longitude } = locationData;
                        const regeoUrl = `https://restapi.amap.com/v3/geocode/regeo?output=json&location=${longitude},${latitude}&key=${apiKey}`;
                        const regeoResponse = await fetch(regeoUrl);
                        if (!regeoResponse.ok) throw new Error('高德地理编码服务失败');
                        const regeoData = await regeoResponse.json();
                        if (regeoData.status !== '1') throw new Error(regeoData.info || '高德地理编码错误');
                        const adcode = regeoData.regeocode.addressComponent.adcode;
                        const weatherUrl = `https://restapi.amap.com/v3/weather/weatherInfo?city=${adcode}&key=${apiKey}&extensions=all`;
                        const weatherResponse = await fetch(weatherUrl);
                        if (!weatherResponse.ok) throw new Error('高德天气服务失败');
                        const weatherData = await weatherResponse.json();
                        if (weatherData.status !== '1') throw new Error(weatherData.info || '高德天气查询错误');
                        
                        // 获取天气数据
                        if (!weatherData.forecasts || weatherData.forecasts.length === 0) {
                            throw new Error('未获取到天气预报数据');
                        }
                        const forecast = weatherData.forecasts[0];
                        if (!forecast.casts || forecast.casts.length === 0) {
                            throw new Error('天气数据格式不正确');
                        }
                        const today = forecast.casts[0];
                        
                        // 显示精简位置信息（直接使用高德天气API返回的城市/区县名，正好是县级市/区级别）
                        const locationName = forecast.city || regeoData.regeocode.addressComponent.district || regeoData.regeocode.addressComponent.city;
                        
                        document.getElementById('weather-location').textContent = locationName;
                        
                        // 显示日期和时间
                        const now = new Date();
                        const datetimeStr = now.toLocaleString('zh-CN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                        document.getElementById('weather-datetime').textContent = datetimeStr;
                        
                        // 显示天气主信息
                        document.getElementById('weather-description').textContent = today.dayweather;
                        document.getElementById('weather-temperature').textContent = `${today.daytemp}°`;
                        
                        // 更新小组件天气信息
                        const widgetWeather = document.getElementById('widget-weather');
                        if (widgetWeather) {
                            const iconClass = getWeatherIcon(today.dayweather);
                            widgetWeather.innerHTML = `<i class="fas ${iconClass}"></i> ${today.daytemp}° ${today.dayweather}`;
                        }
                        
                        // 更新天气图标
                        const iconClass = getWeatherIcon(today.dayweather);
                        const weatherIcon = document.getElementById('weather-icon');
                        weatherIcon.innerHTML = `<i class="fas ${iconClass}"></i>`;
                        
                        // 根据天气类型添加额外的类
                        weatherIcon.className = 'weather-icon';
                        
                        // 更新背景样式
                        updateWeatherBackground(today.dayweather);
                        
                        // 显示天气详情
                        document.getElementById('weather-humidity').textContent = '50%'; // 预报API不含湿度，设为默认
                        document.getElementById('weather-wind').textContent = `${today.daywind}风 ${today.daypower}级`;
                        document.getElementById('weather-visibility').textContent = '10km';
                        document.getElementById('weather-pressure').textContent = '1013hPa';
                        
                        // 更新预报列表
                        const forecastList = document.getElementById('weather-forecast-list');
                        forecastList.innerHTML = '';
                        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
                        forecast.casts.slice(0, 4).forEach((cast, index) => {
                            const dayName = index === 0 ? '今天' : weekdays[new Date(cast.date).getDay()];
                            const iconClass = getWeatherIcon(cast.dayweather);
                            const forecastItem = document.createElement('div');
                            forecastItem.className = 'forecast-item';
                            
                            // 根据天气类型添加额外的类
                            if (cast.dayweather === '阴') {
                                forecastItem.classList.add('cloudy');
                            }
                            
                            forecastItem.innerHTML = `
                                <span class="day-name">${dayName}</span>
                                <i class="fas ${iconClass}"></i>
                                <span class="temp-range">${cast.nighttemp}° - ${cast.daytemp}°</span>
                            `;
                            forecastList.appendChild(forecastItem);
                        });
                    } catch (err) {
                        throw err;
                    }
                }
                
                // 加载默认城市天气（备用方案）
                function loadDefaultWeather(apiKey) {
                    try {
                        // 优先使用用户自选的地区
                        const manualCityJson = localStorage.getItem('weather_manual_city');
                        let cityAdcode = '110000'; // 默认北京
                        let isManual = false;

                        if (manualCityJson) {
                            try {
                                const manualCity = JSON.parse(manualCityJson);
                                cityAdcode = manualCity.adcode;
                                isManual = true;
                                console.log('定位失败，使用自选城市:', manualCity.name);
                            } catch (e) {
                                console.error('解析自选城市失败:', e);
                            }
                        }

                        const weatherUrl = `https://restapi.amap.com/v3/weather/weatherInfo?city=${cityAdcode}&key=${apiKey}&extensions=all`;
                        fetch(weatherUrl)
                            .then(response => {
                                if (!response.ok) {
                                    throw new Error('网络响应错误');
                                }
                                return response.json();
                            })
                            .then(weatherData => {
                                if (weatherData.status === '1' && weatherData.forecasts && weatherData.forecasts.length > 0) {
                                    // 获取天气数据
                                    const forecast = weatherData.forecasts[0];
                                    const today = forecast.casts[0];
                                    
                                    // 显示位置信息
                                    document.getElementById('weather-location').textContent = (isManual ? '📍 ' : '') + forecast.city;
                                    
                                    // 显示日期和时间
                                    const now = new Date();
                                    const datetimeStr = now.toLocaleString('zh-CN', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    });
                                    document.getElementById('weather-datetime').textContent = datetimeStr;
                                    
                                    // 更新背景样式
                                    updateWeatherBackground(today.dayweather);
                                    
                                    // 显示天气主信息
                                    document.getElementById('weather-description').textContent = today.dayweather;
                                    document.getElementById('weather-temperature').textContent = `${today.daytemp}°`;
                                    
                                    // 更新小组件天气信息
                                    const widgetWeather = document.getElementById('widget-weather');
                                    if (widgetWeather) {
                                        const iconClass = getWeatherIcon(today.dayweather);
                                        widgetWeather.innerHTML = `<i class="fas ${iconClass}"></i> ${today.daytemp}° ${today.dayweather}`;
                                    }
                                    
                                    // 更新天气图标
                                    const iconClass = getWeatherIcon(today.dayweather);
                                    const weatherIcon = document.getElementById('weather-icon');
                                    weatherIcon.innerHTML = `<i class="fas ${iconClass}"></i>`;
                                    
                                    // 根据天气类型添加额外的类
                                    weatherIcon.className = 'weather-icon';
                                    
                                    // 更新背景样式
                                    updateWeatherBackground(today.dayweather);
                                    
                                    // 显示天气详情
                                    document.getElementById('weather-humidity').textContent = '50%';
                                    document.getElementById('weather-wind').textContent = `${today.daywind}风 ${today.daypower}级`;
                                    document.getElementById('weather-visibility').textContent = '10km';
                                    document.getElementById('weather-pressure').textContent = '1013hPa';
                                    
                                    // 更新预报列表
                                    const forecastList = document.getElementById('weather-forecast-list');
                                    forecastList.innerHTML = '';
                                    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
                                    forecast.casts.slice(0, 4).forEach((cast, index) => {
                                        const dayName = index === 0 ? '今天' : weekdays[new Date(cast.date).getDay()];
                                        const iconClass = getWeatherIcon(cast.dayweather);
                                        const forecastItem = document.createElement('div');
                                        forecastItem.className = 'forecast-item';
                                        
                                        // 根据天气类型添加额外的类
                                        if (cast.dayweather === '阴') {
                                            forecastItem.classList.add('cloudy');
                                        }
                                        
                                        forecastItem.innerHTML = `
                                            <span class="day-name">${dayName}</span>
                                            <i class="fas ${iconClass}"></i>
                                            <span class="temp-range">${cast.nighttemp}° - ${cast.daytemp}°</span>
                                        `;
                                        forecastList.appendChild(forecastItem);
                                    });
                                } else {
                                    const errorMsg = weatherData.info || '无法获取默认城市天气数据';
                                    showWeatherError(errorMsg);
                                }
                            })
                            .catch(err => {
                                console.error('默认城市天气获取失败:', err);
                                showWeatherError('网络连接失败或API错误');
                            });
                    } catch (err) {
                        console.error('默认天气加载异常:', err);
                        showWeatherError('天气服务异常');
                    }
                }
            }

            // --- 主题商店功能 ---
            // --- 壁纸商店功能 ---
            const wallpapers = [
                {
                    id: 'default',
                    name: '默认黑色',
                    description: '极简纯黑，回归纯粹',
                    wallpaper: 'none',
                    darkWallpaper: 'none'
                }
            ];

            // 处理自定义壁纸上传
            window.handleCustomWallpaperUpload = function(event, mode) {
                const file = event.target.files[0];
                if (!file) return;

                if (!file.type.startsWith('image/')) {
                    alert('请选择有效的图片文件！');
                    return;
                }

                // 检查文件大小，如果太大则提醒
                if (file.size > 5 * 1024 * 1024) {
                    alert('图片文件过大，请选择 5MB 以下的图片。');
                    return;
                }

                const reader = new FileReader();
                reader.onload = function(e) {
                    const img = new Image();
                    img.onload = function() {
                        // 使用 Canvas 压缩图片
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;
                        
                        // 限制最大尺寸以节省存储空间
                        const MAX_SIZE = 1200;
                        if (width > height) {
                            if (width > MAX_SIZE) {
                                height *= MAX_SIZE / width;
                                width = MAX_SIZE;
                            }
                        } else {
                            if (height > MAX_SIZE) {
                                width *= MAX_SIZE / height;
                                height = MAX_SIZE;
                            }
                        }
                        
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        // 转换为压缩后的 base64
                        const base64Data = canvas.toDataURL('image/jpeg', 0.8);
                        
                        try {
                            const storageKey = mode === 'light' ? 'customWallpaperLight' : 'customWallpaperDark';
                            localStorage.setItem(storageKey, base64Data);
                            localStorage.setItem('selectedWallpaper', 'custom');
                            
                            // 立即应用壁纸
                            const isDarkMode = document.body.classList.contains('dark-mode');
                            const wallpaperElement = document.getElementById('wallpaper');
                            if ((mode === 'dark' && isDarkMode) || (mode === 'light' && !isDarkMode)) {
                                if (wallpaperElement) {
                                    wallpaperElement.style.backgroundImage = `url('${base64Data}')`;
                                }
                            }
                            
                            // 更新预览图
                            const preview = document.getElementById(`custom-wallpaper-${mode}-preview`);
                            if (preview) {
                                preview.innerHTML = `<img src="${base64Data}" style="width: 100%; height: 100%; object-fit: cover;">`;
                            }
                            
                            loadWallpapers();
                            alert(`${mode === 'light' ? '白天' : '暗黑'}模式自定义壁纸已保存并应用！`);
                        } catch (error) {
                            console.error('存储失败:', error);
                            alert('保存失败：存储空间已满，请尝试上传较小的图片或清除其他缓存。');
                        }
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            };

            // 清除自定义壁纸，恢复默认
            window.clearCustomWallpaper = function() {
                localStorage.removeItem('customWallpaperLight');
                localStorage.removeItem('customWallpaperDark');
                applyWallpaper('default');
                
                // 重置预览图
                const lightPreview = document.getElementById('custom-wallpaper-light-preview');
                const darkPreview = document.getElementById('custom-wallpaper-dark-preview');
                
                if (lightPreview) {
                    lightPreview.innerHTML = `
                        <div style="text-align: center;">
                            <i class="fas fa-sun" style="font-size: 24px; color: #ffcc00; display: block; margin-bottom: 4px;"></i>
                            <span style="color: #666; font-size: 12px;">上传图片</span>
                        </div>
                    `;
                }
                if (darkPreview) {
                    darkPreview.innerHTML = `
                        <div style="text-align: center;">
                            <i class="fas fa-moon" style="font-size: 24px; color: #5856D6; display: block; margin-bottom: 4px;"></i>
                            <span style="color: #666; font-size: 12px;">上传图片</span>
                        </div>
                    `;
                }
            };

            // 加载自定义壁纸预览（初始化时调用）
            function loadCustomWallpaperPreview() {
                const lightData = localStorage.getItem('customWallpaperLight');
                const darkData = localStorage.getItem('customWallpaperDark');
                
                if (lightData) {
                    const lightPreview = document.getElementById('custom-wallpaper-light-preview');
                    if (lightPreview) {
                        lightPreview.innerHTML = `<img src="${lightData}" style="width: 100%; height: 100%; object-fit: cover;">`;
                    }
                }
                if (darkData) {
                    const darkPreview = document.getElementById('custom-wallpaper-dark-preview');
                    if (darkPreview) {
                        darkPreview.innerHTML = `<img src="${darkData}" style="width: 100%; height: 100%; object-fit: cover;">`;
                    }
                }
            }

            // 加载自定义小组件背景预览
            function loadWidgetBgPreview() {
                const widgetData = localStorage.getItem('customWidgetBg');
                if (widgetData) {
                    const preview = document.getElementById('custom-widget-bg-preview');
                    if (preview) {
                        preview.innerHTML = `<img src="${widgetData}" style="width: 100%; height: 100%; object-fit: cover;">`;
                    }
                }
            }

            // 处理小组件背景上传
            window.handleWidgetBgUpload = function(event) {
                const file = event.target.files[0];
                if (!file) return;

                if (!file.type.startsWith('image/')) {
                    alert('请选择有效的图片文件！');
                    return;
                }

                const reader = new FileReader();
                reader.onload = function(e) {
                    const img = new Image();
                    img.onload = function() {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;
                        const MAX_SIZE = 800; // 小组件底图不需要太大
                        if (width > height) {
                            if (width > MAX_SIZE) {
                                height *= MAX_SIZE / width;
                                width = MAX_SIZE;
                            }
                        } else {
                            if (height > MAX_SIZE) {
                                width *= MAX_SIZE / height;
                                height = MAX_SIZE;
                            }
                        }
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        const base64Data = canvas.toDataURL('image/jpeg', 0.8);
                        
                        try {
                            localStorage.setItem('customWidgetBg', base64Data);
                            // 立即应用
                            document.documentElement.style.setProperty('--widget-bg-url', `url('${base64Data}')`);
                            // 更新预览
                            const preview = document.getElementById('custom-widget-bg-preview');
                            if (preview) {
                                preview.innerHTML = `<img src="${base64Data}" style="width: 100%; height: 100%; object-fit: cover;">`;
                            }
                            alert('小组件底图已更换！');
                        } catch (error) {
                            alert('保存失败：存储空间不足');
                        }
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            };

            // 清除小组件背景
            window.clearWidgetBg = function() {
                localStorage.removeItem('customWidgetBg');
                document.documentElement.style.removeProperty('--widget-bg-url');
                const preview = document.getElementById('custom-widget-bg-preview');
                if (preview) {
                    preview.innerHTML = `
                        <div style="text-align: center;">
                            <i class="fas fa-clock" style="font-size: 24px; color: #007aff; display: block; margin-bottom: 4px;"></i>
                            <span style="color: #666; font-size: 12px;">更换小组件背景</span>
                        </div>
                    `;
                }
                alert('已恢复小组件默认背景');
            };

            function loadWallpapers() {
                const container = document.getElementById('wallpapers-container');
                const currentWallpaperId = localStorage.getItem('selectedWallpaper') || 'default';

                container.innerHTML = wallpapers.map(wp => `
                    <div class="theme-card" data-wallpaper-id="${wp.id}">
                        <div class="theme-preview" style="background-image: url('${wp.wallpaper}')">
                            ${wp.id === currentWallpaperId ? '<div class="theme-badge">使用中</div>' : ''}
                        </div>
                        <div class="theme-info">
                            <h3 class="theme-name">${wp.name}</h3>
                            <p class="theme-description">${wp.description}</p>
                            <div class="theme-actions">
                                <button class="theme-btn theme-btn-primary ${wp.id === currentWallpaperId ? 'active' : ''}"
                                        onclick="applyWallpaper('${wp.id}')">
                                    ${wp.id === currentWallpaperId ? '✓ 已应用' : '应用壁纸'}
                                </button>
                                <button class="theme-btn theme-btn-secondary" onclick="previewWallpaper('${wp.id}')">
                                    预览
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('');
            }

            // 图标自定义功能
            const customizableApps = [
                { app: 'phone', name: '电话', icon: 'fas fa-phone' },
                { app: 'messages', name: '信息', icon: 'fas fa-comment' },
                { app: 'safari', name: 'Safari', icon: 'fas fa-globe' },
                { app: 'weather', name: '天气', icon: 'fas fa-cloud-sun' },
                { app: 'settings', name: '设置', icon: 'fas fa-cog' },
                { app: 'camera', name: '相机', icon: 'fas fa-camera' },
                { app: 'photos', name: '照片', icon: 'fas fa-images' },
                { app: 'appstore', name: 'App Store', icon: 'fab fa-app-store-ios' },
                { app: 'themes', name: '主题商店', icon: 'fas fa-palette' },
                { app: 'wechat', name: '微信', icon: 'fab fa-weixin' },
                { app: 'music', name: '音乐', icon: 'fas fa-music' },
                { app: 'calculator', name: '计算器', icon: 'fas fa-calculator' },
                { app: 'clock', name: '时钟', icon: 'fas fa-clock' },
                { app: 'calendar', name: '日历', icon: 'fas fa-calendar-alt' },
                { app: 'notes', name: '备忘录', icon: 'fas fa-sticky-note' }
            ];

            // 加载自定义图标界面
            function loadIconCustomization() {
                const container = document.getElementById('icon-customization-container');
                
                container.innerHTML = `
                    <div class="icon-customization-section">
                        <div class="app-icons-grid">
                            ${customizableApps.map(app => `
                                <div class="customizable-app-item">
                                    <div class="app-icon-preview">
                                        <div class="icon" id="icon-preview-${app.app}" style="background: linear-gradient(135deg, #0A84FF, #0066CC);">
                                            ${getCustomIconHTML(app.app, app.icon)}
                                        </div>
                                    </div>
                                    <div class="app-name">${app.name}</div>
                                    <div class="app-icon-actions">
                                        <input type="file" id="icon-file-${app.app}" accept="image/*" style="display: none;" onchange="handleIconUpload(event, '${app.app}')">
                                        <button class="icon-action-btn" onclick="document.getElementById('icon-file-${app.app}').click()">
                                            更换图标
                                        </button>
                                        <button class="icon-action-btn secondary" onclick="resetAppIcon('${app.app}', '${app.icon}')">
                                            重置
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            // 获取自定义图标HTML
            function getCustomIconHTML(appName, defaultIcon) {
                const customIcon = localStorage.getItem(`custom-icon-${appName}`);
                if (customIcon) {
                    return `<img src="${customIcon}" style="width: 100%; height: 100%; object-fit: cover;">`;
                }
                if (appName === 'calendar') {
                    return `
                        <div class="cal-weekday">周三</div>
                        <div class="cal-day">8</div>
                    `;
                }
                return `<i class="${defaultIcon}"></i>`;
            }

            // 处理图标上传
            window.handleIconUpload = function(event, appName) {
                const file = event.target.files[0];
                if (!file) return;

                if (!file.type.startsWith('image/')) {
                    alert('请选择有效的图片文件！');
                    return;
                }

                const reader = new FileReader();
                reader.onload = function(e) {
                    const img = new Image();
                    img.onload = function() {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;
                        const MAX_SIZE = 120; // 图标不需要太大
                        if (width > height) {
                            if (width > MAX_SIZE) {
                                height *= MAX_SIZE / width;
                                width = MAX_SIZE;
                            }
                        } else {
                            if (height > MAX_SIZE) {
                                width *= MAX_SIZE / height;
                                height = MAX_SIZE;
                            }
                        }
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        // 使用 PNG 格式以保留透明度
                        const iconDataUrl = canvas.toDataURL('image/png');
                        
                        try {
                            // 显示预览
                            const previewElement = document.getElementById(`icon-preview-${appName}`);
                            previewElement.innerHTML = `<img src="${iconDataUrl}" style="width: 100%; height: 100%; object-fit: cover;">`;
                            previewElement.style.backgroundImage = 'none';
                            previewElement.style.backgroundColor = 'transparent';
                            
                            // 保存图标
                            saveCustomIcon(appName, iconDataUrl);
                        } catch (error) {
                            alert('保存失败：存储空间不足');
                        }
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }

            // 保存自定义图标
            function saveCustomIcon(appName, iconDataUrl) {
                try {
                    localStorage.setItem(`custom-icon-${appName}`, iconDataUrl);
                    // 更新主屏幕上的图标
                    updateHomeScreenIcon(appName, iconDataUrl);
                } catch (error) {
                    console.error('保存图标失败:', error);
                    alert('保存失败：存储空间已满，请清除其他缓存。');
                }
            }

            // 更新主屏幕图标
            function updateHomeScreenIcon(appName, iconDataUrl) {
                const appIcons = document.querySelectorAll(`.app-icon[data-app="${appName}"] .icon`);
                appIcons.forEach(icon => {
                    icon.innerHTML = `<img src="${iconDataUrl}" style="width: 100%; height: 100%; object-fit: cover;">`;
                    icon.style.backgroundImage = 'none';
                    icon.style.backgroundColor = 'transparent';
                });
            }

            // 重置应用图标
            window.resetAppIcon = function(appName, defaultIcon) {
                localStorage.removeItem(`custom-icon-${appName}`);
                
                let defaultHTML = `<i class="${defaultIcon}"></i>`;
                if (appName === 'calendar') {
                    defaultHTML = `
                        <div class="cal-weekday">周三</div>
                        <div class="cal-day">8</div>
                    `;
                }

                // 更新预览
                const previewElement = document.getElementById(`icon-preview-${appName}`);
                if (previewElement) {
                    previewElement.innerHTML = defaultHTML;
                    previewElement.style.backgroundImage = '';
                    previewElement.style.backgroundColor = '';
                }
                
                // 更新主屏幕图标
                const appIcons = document.querySelectorAll(`.app-icon[data-app="${appName}"] .icon`);
                appIcons.forEach(icon => {
                    icon.innerHTML = defaultHTML;
                    icon.style.backgroundImage = '';
                    icon.style.backgroundColor = '';
                });
            }

            // 初始化自定义图标
            function initCustomIcons() {
                customizableApps.forEach(app => {
                    const customIcon = localStorage.getItem(`custom-icon-${app.app}`);
                    if (customIcon) {
                        updateHomeScreenIcon(app.app, customIcon);
                    }
                });
            }

            // 标签切换功能
            function initThemeTabs() {
                const tabs = document.querySelectorAll('.theme-tab');
                tabs.forEach(tab => {
                    tab.addEventListener('click', () => {
                        // 移除所有活动状态
                        document.querySelectorAll('.theme-tab').forEach(t => t.classList.remove('active'));
                        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                        
                        // 添加当前活动状态
                        tab.classList.add('active');
                        const tabId = tab.dataset.tab;
                        document.getElementById(`tab-${tabId}`).classList.add('active');
                    });
                });
            }

            window.applyWallpaper = function(wpId) {
                const wp = wallpapers.find(w => w.id === wpId);
                if (!wp) return;

                const isDarkMode = document.body.classList.contains('dark-mode');
                const wallpaperUrl = isDarkMode ? wp.darkWallpaper : wp.wallpaper;

                // 更新壁纸
                if (wallpaperUrl === 'none') {
                    wallpaper.style.backgroundImage = 'none';
                } else {
                    wallpaper.style.backgroundImage = `url('${wallpaperUrl}')`;
                }
                
                // 保存选择
                localStorage.setItem('selectedWallpaper', wpId);
                localStorage.setItem('themeWallpaper', wp.wallpaper);
                localStorage.setItem('themeDarkWallpaper', wp.darkWallpaper);

                // 重新加载列表以更新UI
                loadWallpapers();

                // 显示提示
                alert(`壁纸 "${wp.name}" 已应用！`);
            };

            window.previewWallpaper = function(wpId) {
                const wp = wallpapers.find(w => w.id === wpId);
                if (!wp) return;

                const isDarkMode = document.body.classList.contains('dark-mode');
                const wallpaperUrl = isDarkMode ? wp.darkWallpaper : wp.wallpaper;

                // 保存当前样式以便恢复
                const currentWallpaper = wallpaper.style.backgroundImage;

                // 临时预览壁纸
                if (wallpaperUrl === 'none') {
                    wallpaper.style.backgroundImage = 'none';
                } else {
                    wallpaper.style.backgroundImage = `url('${wallpaperUrl}')`;
                }
                
                // 3秒后恢复原样式
                setTimeout(() => {
                    const customLight = localStorage.getItem('customWallpaperLight');
                    const customDark = localStorage.getItem('customWallpaperDark');
                    const savedWpId = localStorage.getItem('selectedWallpaper') || 'default';
                    
                    if (savedWpId === 'custom') {
                        const customWallpaper = isDarkMode ? (customDark || customLight) : (customLight || customDark);
                        if (customWallpaper) {
                            wallpaper.style.backgroundImage = `url('${customWallpaper}')`;
                            return;
                        }
                    }

                    const savedWp = wallpapers.find(w => w.id === savedWpId);
                    if (savedWp) {
                        const savedWallpaper = isDarkMode ? savedWp.darkWallpaper : savedWp.wallpaper;
                        if (savedWallpaper === 'none') {
                            wallpaper.style.backgroundImage = 'none';
                        } else {
                            wallpaper.style.backgroundImage = `url('${savedWallpaper}')`;
                        }
                    }
                }, 3000);
            };

            // 加载保存的壁纸
            function loadSavedWallpaper() {
                const customLight = localStorage.getItem('customWallpaperLight');
                const customDark = localStorage.getItem('customWallpaperDark');
                const savedWpId = localStorage.getItem('selectedWallpaper') || 'default';
                const isDarkMode = document.body.classList.contains('dark-mode');
                
                if (savedWpId === 'custom') {
                    const customWallpaper = isDarkMode ? (customDark || customLight) : (customLight || customDark);
                    if (customWallpaper) {
                        wallpaper.style.backgroundImage = `url('${customWallpaper}')`;
                        return;
                    }
                }

                const wp = wallpapers.find(w => w.id === savedWpId);
                if (wp) {
                    const wallpaperUrl = isDarkMode ? wp.darkWallpaper : wp.wallpaper;
                    if (wallpaperUrl === 'none') {
                        wallpaper.style.backgroundImage = 'none';
                    } else {
                        wallpaper.style.backgroundImage = `url('${wallpaperUrl}')`;
                    }
                }
            }

            // 加载保存的小组件背景
            function loadSavedWidgetBg() {
                const widgetData = localStorage.getItem('customWidgetBg');
                if (widgetData) {
                    document.documentElement.style.setProperty('--widget-bg-url', `url('${widgetData}')`);
                }
            }

            // --- 自定义CSS功能 ---
            function initCustomCSS() {
                const savedCSS = localStorage.getItem('customGlobalCSS') || '';
                const textarea = document.getElementById('custom-css-input');
                if (textarea) textarea.value = savedCSS;
                
                injectCustomCSS(savedCSS);
            }
            
            function injectCustomCSS(cssContent) {
                let styleTag = document.getElementById('custom-theme-style');
                if (!styleTag) {
                    styleTag = document.createElement('style');
                    styleTag.id = 'custom-theme-style';
                    document.head.appendChild(styleTag);
                }
                styleTag.innerHTML = cssContent;
            }

            window.applyCustomCSS = function() {
                const textarea = document.getElementById('custom-css-input');
                const cssContent = textarea ? textarea.value : '';
                localStorage.setItem('customGlobalCSS', cssContent);
                injectCustomCSS(cssContent);
                alert('自定义 CSS 已保存并应用！');
            };

            window.clearCustomCSS = function() {
                if (confirm('确定要清除所有自定义样式吗？')) {
                    const textarea = document.getElementById('custom-css-input');
                    if (textarea) textarea.value = '';
                    localStorage.removeItem('customGlobalCSS');
                    injectCustomCSS('');
                    alert('自定义 CSS 已清除！');
                }
            };

            window.exportCustomCSS = function() {
                const cssContent = localStorage.getItem('customGlobalCSS') || '';
                if (!cssContent) {
                    alert('当前没有可导出的自定义 CSS。');
                    return;
                }
                const blob = new Blob([cssContent], { type: 'text/css' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'custom-theme.css';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            };

            window.importCustomCSS = function(event) {
                const file = event.target.files[0];
                if (!file) return;
                
                const reader = new FileReader();
                reader.onload = function(e) {
                    const cssContent = e.target.result;
                    const textarea = document.getElementById('custom-css-input');
                    if (textarea) textarea.value = cssContent;
                    
                    localStorage.setItem('customGlobalCSS', cssContent);
                    injectCustomCSS(cssContent);
                    alert('自定义 CSS 导入成功并已应用！');
                };
                reader.readAsText(file);
                // 清空 input value 以便重复导入同一个文件
                event.target.value = '';
            };

            // 监听暗黑模式切换，更新壁纸
            const originalDarkModeToggle = darkModeToggle;
            darkModeToggle.addEventListener('change', () => {
                setTimeout(() => {
                    loadSavedWallpaper();
                }, 100);
            });

            // --- iOS辅助触控（小白点）功能 ---
            function initAssistiveTouch() {
                const assistiveTouch = document.getElementById('assistive-touch');
                const assistiveTouchMenu = document.getElementById('assistive-touch-menu');
                
                if (!assistiveTouch || !assistiveTouchMenu) return;
                
                let isDragging = false;
                let hasMoved = false;
                let startX = 0, startY = 0;
                let startLeft = 0, startTop = 0;
                let currentX = 0, currentY = 0;
                let menuVisible = false;
                let rafId = null;
                
                // 从localStorage加载位置
                const savedPosition = localStorage.getItem('assistiveTouchPosition');
                if (savedPosition) {
                    try {
                        const { x, y } = JSON.parse(savedPosition);
                        if (!isNaN(x) && !isNaN(y)) {
                            currentX = x;
                            currentY = y;
                            assistiveTouch.style.left = '0';
                            assistiveTouch.style.top = '0';
                            assistiveTouch.style.transform = `translate3d(${x}px, ${y}px, 0)`;
                        }
                    } catch (e) { console.error('加载位置失败', e); }
                } else {
                    // 默认位置
                    currentX = window.innerWidth - 80;
                    currentY = window.innerHeight - 200;
                    assistiveTouch.style.left = '0';
                    assistiveTouch.style.top = '0';
                    assistiveTouch.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
                }
                
                const updatePosition = () => {
                    assistiveTouch.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
                    rafId = null;
                };

                const startDrag = (clientX, clientY) => {
                    if (menuVisible) return;
                    isDragging = true;
                    hasMoved = false;
                    startX = clientX;
                    startY = clientY;
                    startLeft = currentX;
                    startTop = currentY;
                    assistiveTouch.style.transition = 'none';
                    assistiveTouch.classList.add('dragging');
                };

                const doDrag = (clientX, clientY) => {
                    if (!isDragging) return;
                    const dx = clientX - startX;
                    const dy = clientY - startY;
                    
                    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved = true;

                    // 计算目标位置并限制在视口内
                    let targetX = startLeft + dx;
                    let targetY = startTop + dy;
                    
                    const maxX = window.innerWidth - assistiveTouch.offsetWidth - 10;
                    const maxY = window.innerHeight - assistiveTouch.offsetHeight - 10;
                    
                    currentX = Math.max(10, Math.min(targetX, maxX));
                    currentY = Math.max(10, Math.min(targetY, maxY));
                    
                    if (!rafId) {
                        rafId = requestAnimationFrame(updatePosition);
                    }
                };

                const endDrag = () => {
                    if (!isDragging) return;
                    isDragging = false;
                    assistiveTouch.classList.remove('dragging');
                    
                    if (hasMoved) {
                        // 吸附到边缘
                        const windowWidth = window.innerWidth;
                        const margin = 10;
                        const halfWidth = windowWidth / 2;
                        
                        if (currentX + assistiveTouch.offsetWidth / 2 < halfWidth) {
                            currentX = margin;
                        } else {
                            currentX = windowWidth - assistiveTouch.offsetWidth - margin;
                        }

                        assistiveTouch.style.transition = 'transform 0.5s cubic-bezier(0.19, 1, 0.22, 1)';
                        updatePosition();
                        
                        localStorage.setItem('assistiveTouchPosition', JSON.stringify({
                            x: currentX,
                            y: currentY
                        }));
                    }
                };

                assistiveTouch.addEventListener('mousedown', (e) => {
                    if (e.target.classList.contains('assistive-touch-item')) return;
                    startDrag(e.clientX, e.clientY);
                });
                document.addEventListener('mousemove', (e) => {
                    if (isDragging) {
                        doDrag(e.clientX, e.clientY);
                    }
                });
                document.addEventListener('mouseup', endDrag);

                assistiveTouch.addEventListener('touchstart', (e) => {
                    if (e.target.classList.contains('assistive-touch-item')) return;
                    const touch = e.touches[0];
                    startDrag(touch.clientX, touch.clientY);
                }, { passive: true });
                document.addEventListener('touchmove', (e) => {
                    if(isDragging) {
                        const touch = e.touches[0];
                        doDrag(touch.clientX, touch.clientY);
                        if (e.cancelable) e.preventDefault();
                    }
                }, { passive: false });
                document.addEventListener('touchend', endDrag, { passive: true });
                


                // 辅助函数：移动到中心
                function moveToCenter() {
                    const centerX = window.innerWidth / 2 - assistiveTouch.offsetWidth / 2;
                    const centerY = window.innerHeight / 2 - assistiveTouch.offsetHeight / 2;
                    
                    assistiveTouch.style.transition = 'transform 0.5s cubic-bezier(0.19, 1, 0.22, 1)';
                    assistiveTouch.style.transform = `translate3d(${centerX}px, ${centerY}px, 0)`;
                    
                    menuVisible = true;
                    assistiveTouchMenu.classList.add('active');
                    assistiveTouch.classList.add('active');
                }
                
                // 辅助函数：缩回原位
                function moveBack() {
                    assistiveTouch.style.transition = 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)';
                    updatePosition();
                    
                    menuVisible = false;
                    assistiveTouchMenu.classList.remove('active');
                    assistiveTouch.classList.remove('active');
                }

                // 响应式调整
                window.addEventListener('resize', () => {
                    const maxX = window.innerWidth - assistiveTouch.offsetWidth - 10;
                    const maxY = window.innerHeight - assistiveTouch.offsetHeight - 10;
                    
                    if (currentX > maxX || currentY > maxY) {
                        currentX = Math.min(currentX, maxX);
                        currentY = Math.min(currentY, maxY);
                        updatePosition();
                    }
                }, { passive: true });
                
                // 点击显示/隐藏菜单
                assistiveTouch.addEventListener('click', (e) => {
                    if (hasMoved || e.target.classList.contains('assistive-touch-item')) return;
                    
                    if (!menuVisible) {
                        moveToCenter();
                    } else {
                        moveBack();
                    }
                });
                
                // 点击菜单项
                document.querySelectorAll('.assistive-touch-item').forEach(item => {
                    item.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const action = item.dataset.action;
                        
                        switch (action) {
                            case 'home':
                                // 立即执行返回，不等待菜单收起
                                closeApps();
                                // moveBack 负责收起菜单，可以稍微延迟以确保动画流畅
                                moveBack();
                                break;
                            case 'app-switcher':
                                alert('应用切换功能');
                                moveBack();
                                break;
                            case 'control-center':
                                const controlCenter = document.getElementById('control-center');
                                if (controlCenter) {
                                    controlCenter.classList.add('active');
                                }
                                moveBack();
                                break;
                            case 'screenshot':
                                moveBack();
                                setTimeout(() => {
                                    takeScreenshot();
                                }, 260);
                                break;
                            default:
                                moveBack();
                                break;
                        }
                    });
                });
                
                // 点击其他地方关闭菜单
                document.addEventListener('click', (e) => {
                    if (menuVisible && !assistiveTouch.contains(e.target)) {
                        moveBack();
                    }
                });
            }
            
            // 截图功能
            let isTakingScreenshot = false;
            async function takeScreenshot() {
                if (isTakingScreenshot) return;
                isTakingScreenshot = true;
                
                const assistiveTouch = document.getElementById('assistive-touch');
                const originalAssistiveTouchVisibility = assistiveTouch ? assistiveTouch.style.visibility : '';
                
                // 1. 立即反馈：闪白动画
                const flashOverlay = document.createElement('div');
                flashOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#fff;z-index:1000000;opacity:0;transition:opacity 0.05s ease;pointer-events:none;';
                document.body.appendChild(flashOverlay);
                
                requestAnimationFrame(() => {
                    flashOverlay.style.opacity = '0.8';
                    setTimeout(() => {
                        flashOverlay.style.opacity = '0';
                        setTimeout(() => flashOverlay.remove(), 100);
                    }, 50);
                });

                try {
                    if (typeof html2canvas === 'undefined') {
                        throw new Error('未加载 html2canvas 库');
                    }

                    const targetElement = document.getElementById('phone-ui-container') || document.body;
                    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

                    // 2. 准备阶段
                    if (assistiveTouch) {
                        assistiveTouch.style.visibility = 'hidden';
                    }

                    // 缩短等待
                    await new Promise(resolve => setTimeout(resolve, 30));

                    // 3. 执行截图：使用高兼容性配置
                    const canvas = await html2canvas(targetElement, {
                        scale: isIOS ? 1 : 1.2,
                        useCORS: true,
                        allowTaint: false,
                        backgroundColor: '#000',
                        logging: false,
                        imageTimeout: 15000,
                        removeContainer: true,
                        foreignObjectRendering: false, // 禁用以提高稳定性
                        width: targetElement.offsetWidth,
                        height: targetElement.offsetHeight,
                        // 关键优化：在克隆的 DOM 中移除所有导致失败的复杂样式
                        onclone: (clonedDoc) => {
                            const elements = clonedDoc.getElementsByTagName('*');
                            for (let i = 0; i < elements.length; i++) {
                                const el = elements[i];
                                // 移除 backdrop-filter，这是 html2canvas 崩溃的首要原因
                                if (window.getComputedStyle(el).backdropFilter !== 'none' || 
                                    window.getComputedStyle(el).webkitBackdropFilter !== 'none') {
                                    el.style.backdropFilter = 'none';
                                    el.style.webkitBackdropFilter = 'none';
                                    // 补偿：如果背景太透明，稍微加深一点背景色防止内容看不清
                                    const bg = window.getComputedStyle(el).backgroundColor;
                                    if (bg.includes('rgba')) {
                                        el.style.backgroundColor = bg.replace(/[\d\.]+\)$/, '0.9)');
                                    }
                                }
                                // 移除某些可能引起渲染问题的动画
                                el.style.animation = 'none';
                                el.style.transition = 'none';
                            }
                            // 确保目标容器在克隆文档中也是可见的
                            const clonedTarget = clonedDoc.getElementById('phone-ui-container');
                            if (clonedTarget) {
                                clonedTarget.style.transform = 'none';
                                clonedTarget.style.position = 'relative';
                                clonedTarget.style.top = '0';
                                clonedTarget.style.left = '0';
                                clonedTarget.style.margin = '0';
                            }
                        }
                    });

                    // 4. 数据转换与保存
                    let screenshotDataUrl = '';
                    try {
                        // 尝试高质量 JPEG
                        screenshotDataUrl = canvas.toDataURL('image/jpeg', 0.9);
                    } catch (e) {
                        // 回退到 PNG
                        screenshotDataUrl = canvas.toDataURL('image/png');
                    }

                    if (!screenshotDataUrl || screenshotDataUrl === 'data:,') {
                        throw new Error('Canvas 转换失败');
                    }

                    await savePhotoToDB(screenshotDataUrl);
                    
                    // 5. 成功反馈
                    showToast('已保存到相册');

                } catch (error) {
                    console.error('截图引擎详细错误:', error);
                    alert('截图失败: ' + error.message);
                } finally {
                    if (assistiveTouch) {
                        assistiveTouch.style.visibility = originalAssistiveTouchVisibility;
                    }
                    isTakingScreenshot = false;
                }
            }

            // 通用 Toast 提示
            function showToast(text) {
                const toast = document.createElement('div');
                toast.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.8);color:#fff;padding:12px 24px;border-radius:20px;z-index:1000001;font-size:14px;pointer-events:none;transition:opacity 0.3s ease;';
                toast.textContent = text;
                document.body.appendChild(toast);
                setTimeout(() => {
                    toast.style.opacity = '0';
                    setTimeout(() => toast.remove(), 300);
                }, 1500);
            }
            
            // 初始化辅助触控已移至 DOMContentLoaded 顶部
            
            // --- Wechat应用功能 ---
            const wechatState = {
                characters: [],
                activeCharacterId: null,
                settings: {
                    theme: 'default',
                    apiKey: '',
                    apiUrl: 'https://api.openai.com/v1/chat/completions',
                    model: 'gpt-4o-mini',
                    allowActionDescription: true
                },
                profile: {
                    nickname: '',
                    wechatid: '',
                    avatar: '',
                    persona: ''
                },
                moments: [],
                momentsCover: '',
                conversationTurns: 0,
                MEMORY_UPDATE_THRESHOLD: 3,
                isSummarizing: false,
                isTyping: false,
                editingCharId: null,
                defaultCharacters: [],
                groups: []
            };

            // 初始化微信界面
            async function initWechat() {
                try {
                    // 从localStorage加载API配置（优先使用小手机设置中的配置）
                    const savedApiUrl = localStorage.getItem('wechatApiUrl');
                    const savedApiKey = localStorage.getItem('wechatApiKey');
                    const savedModel = localStorage.getItem('wechatModel');
                    const savedCustomModel = localStorage.getItem('wechatCustomModel');
                    
                    if (savedApiUrl) wechatState.settings.apiUrl = savedApiUrl;
                    if (savedApiKey) wechatState.settings.apiKey = savedApiKey;
                    if (savedModel) {
                        wechatState.settings.model = savedModel;
                    }
                    if (savedCustomModel) wechatState.settings.customModel = savedCustomModel;
                    
                    // 从IndexedDB加载数据
                    const saved = await loadDataFromIndexedDB(STORES.APP_DATA, 'wechatAppState');
                    if (saved) {
                        // 从IndexedDB加载成功
                        wechatState.characters = saved.characters && saved.characters.length > 0 ? saved.characters : wechatState.defaultCharacters;
                        // 合并设置，但保留从localStorage加载的API配置
                        wechatState.settings = { 
                            ...wechatState.settings, 
                            ...saved.settings,
                            // 优先使用localStorage中的API配置
                            apiUrl: savedApiUrl || saved.settings?.apiUrl || wechatState.settings.apiUrl,
                            apiKey: savedApiKey || saved.settings?.apiKey || wechatState.settings.apiKey,
                            model: savedModel || saved.settings?.model || wechatState.settings.model,
                            customModel: savedCustomModel || saved.settings?.customModel || wechatState.settings.customModel
                        };
                        if (saved.profile) {
                            wechatState.profile = { ...wechatState.profile, ...saved.profile };
                        }
                        wechatState.moments = saved.moments || [];
                        if (saved.momentsCover) {
                            wechatState.momentsCover = saved.momentsCover;
                        }
                        wechatState.groups = saved.groups || [];
                        
                        // 迁移旧的localStorage数据到IndexedDB（如果存在）
                        const oldLocalStorageData = localStorage.getItem('wechat_app_state');
                        if (oldLocalStorageData) {
                            console.log('检测到旧的localStorage数据，将迁移到IndexedDB');
                            localStorage.removeItem('wechat_app_state'); // 清除旧数据
                        }
                    } else {
                        // 检查是否有旧的localStorage数据
                        const oldLocalStorageData = localStorage.getItem('wechat_app_state');
                        if (oldLocalStorageData) {
                            // 从localStorage迁移数据到IndexedDB
                            console.log('从localStorage迁移数据到IndexedDB');
                            const data = JSON.parse(oldLocalStorageData);
                            wechatState.characters = data.characters && data.characters.length > 0 ? data.characters : wechatState.defaultCharacters;
                            wechatState.settings = { ...wechatState.settings, ...data.settings };
                            if (data.profile) {
                                wechatState.profile = { ...wechatState.profile, ...data.profile };
                            }
                            wechatState.moments = data.moments || [];
                            if (data.momentsCover) {
                                wechatState.momentsCover = data.momentsCover;
                            }
                            await saveWechatData();
                            localStorage.removeItem('wechat_app_state'); // 清除旧数据
                        } else {
                            // 初始化默认数据
                            wechatState.characters = wechatState.defaultCharacters;
                            wechatState.moments = [];
                            // 不再初始化默认朋友圈数据，保持朋友圈为空
                            await saveWechatData();
                        }
                    }
                    
                    renderWechatList();
                    applyWechatTheme();
                    renderWechatProfile();
                    renderWechatMoments();
                    updateMomentsCover();
                    initWechatEditProfile();
                    initMomentsCoverUpload();
                    startWechatBackgroundTasks();
                } catch (error) {
                    console.error('初始化微信界面出错:', error);
                    // 出错时使用默认数据
                    wechatState.characters = wechatState.defaultCharacters;
                    wechatState.moments = [];
                    renderWechatList();
                    applyWechatTheme();
                    renderWechatProfile();
                    renderWechatMoments();
                    updateMomentsCover();
                    initWechatEditProfile();
                    initMomentsCoverUpload();
                    startWechatBackgroundTasks();
                }
            }

            // --- IndexedDB 存储实现 --- 
            const DB_NAME = 'wechatAppDB';
            const DB_VERSION = 2; // 增加版本号以支持更多存储对象
            const STORES = {
                APP_DATA: 'appData',
                SETTINGS: 'settings',
                WEATHER: 'weather',
                CUSTOM_ICONS: 'customIcons',
                MUSIC: 'music',
                WECHAT: 'wechat'
            };
            let indexedDBInstance = null;
            
            // 打开IndexedDB数据库
            function openDB() {
                return new Promise((resolve, reject) => {
                    if (indexedDBInstance) {
                        resolve(indexedDBInstance);
                        return;
                    }
                    
                    // iOS 兼容性：某些无痕模式或存储受限环境不支持 IndexedDB
                    if (!window.indexedDB) {
                        console.warn('浏览器不支持 IndexedDB');
                        reject(new Error('IndexedDB not supported'));
                        return;
                    }
                    
                    try {
                        const request = indexedDB.open(DB_NAME, DB_VERSION);
                        
                        // 增加超时控制，防止 iOS 初始化卡死
                        const dbTimeout = setTimeout(() => {
                            reject(new Error('IndexedDB initialization timeout'));
                        }, 5000);

                        // 数据库升级或首次创建
                        request.onupgradeneeded = (event) => {
                            const db = event.target.result;
                            console.log('数据库升级，当前版本:', event.oldVersion, '->', event.newVersion);
                            
                            // 创建所有需要的对象存储空间
                            Object.values(STORES).forEach(storeName => {
                                try {
                                    if (!db.objectStoreNames.contains(storeName)) {
                                        const store = db.createObjectStore(storeName, { keyPath: 'id' });
                                        console.log(`成功创建存储对象: ${storeName}`);
                                    } else {
                                        console.log(`存储对象已存在: ${storeName}`);
                                    }
                                } catch (error) {
                                    console.error(`创建存储对象失败 ${storeName}:`, error);
                                }
                            });
                        };
                        
                        request.onsuccess = (event) => {
                            clearTimeout(dbTimeout);
                            indexedDBInstance = event.target.result;
                            console.log('数据库打开成功，存储对象:', Array.from(indexedDBInstance.objectStoreNames));
                            resolve(indexedDBInstance);
                        };
                        
                        request.onerror = (event) => {
                            clearTimeout(dbTimeout);
                            console.error('打开数据库失败:', event.target.error);
                            reject(event.target.error);
                        };
                    } catch (error) {
                        console.warn('IndexedDB不可用:', error);
                        reject(error);
                    }
                });
            }
            
            // 保存数据到IndexedDB
            async function saveDataToIndexedDB(storeName, data, id) {
                try {
                    const db = await openDB();
                    return new Promise((resolve, reject) => {
                        const transaction = db.transaction(storeName, 'readwrite');
                        const store = transaction.objectStore(storeName);
                        
                        const appData = { id: id || 'default', ...data };
                        const request = store.put(appData);
                        
                        request.onsuccess = () => {
                            console.log(`数据保存到IndexedDB成功 (${storeName})`);
                            resolve();
                        };
                        
                        request.onerror = (event) => {
                            console.error(`保存数据到IndexedDB失败 (${storeName}):`, event.target.error);
                            reject(event.target.error);
                        };
                    });
                } catch (error) {
                    console.error(`保存数据到IndexedDB出错 (${storeName}):`, error);
                    throw error;
                }
            }
            
            // 从IndexedDB加载数据
            async function loadDataFromIndexedDB(storeName, id) {
                try {
                    const db = await openDB();
                    return new Promise((resolve, reject) => {
                        const transaction = db.transaction(storeName, 'readonly');
                        const store = transaction.objectStore(storeName);
                        
                        const request = store.get(id || 'default');
                        
                        request.onsuccess = (event) => {
                            const data = event.target.result;
                            console.log(`从IndexedDB加载数据成功 (${storeName}):`, data);
                            resolve(data || null);
                        };
                        
                        request.onerror = (event) => {
                            console.error(`从IndexedDB加载数据失败 (${storeName}):`, event.target.error);
                            reject(event.target.error);
                        };
                    });
                } catch (error) {
                    console.error(`从IndexedDB加载数据出错 (${storeName}):`, error);
                    throw error;
                }
            }
            
            // 从IndexedDB删除数据
            async function deleteDataFromIndexedDB(storeName, id) {
                try {
                    const db = await openDB();
                    return new Promise((resolve, reject) => {
                        const transaction = db.transaction(storeName, 'readwrite');
                        const store = transaction.objectStore(storeName);
                        
                        const request = store.delete(id);
                        
                        request.onsuccess = () => {
                            console.log(`从IndexedDB删除数据成功 (${storeName})`);
                            resolve();
                        };
                        
                        request.onerror = (event) => {
                            console.error(`从IndexedDB删除数据失败 (${storeName}):`, event.target.error);
                            reject(event.target.error);
                        };
                    });
                } catch (error) {
                    console.error(`从IndexedDB删除数据出错 (${storeName}):`, error);
                    throw error;
                }
            }
            
            // 替换localStorage.getItem
            async function getItem(key, defaultValue = null) {
                try {
                    // 首先尝试从IndexedDB加载
                    let data = null;
                    
                    // 根据key类型选择合适的存储
                    if (key.includes('weather')) {
                        const weatherData = await loadDataFromIndexedDB(STORES.WEATHER);
                        data = weatherData ? weatherData[key] : null;
                    } else if (key.includes('custom-icon')) {
                        const appName = key.replace('custom-icon-', '');
                        const iconData = await loadDataFromIndexedDB(STORES.CUSTOM_ICONS, appName);
                        data = iconData ? iconData.icon : null;
                    } else if (key.includes('music')) {
                        const musicData = await loadDataFromIndexedDB(STORES.MUSIC);
                        data = musicData ? musicData[key] : null;
                    } else if (key.includes('assistiveTouch')) {
                        const settingsData = await loadDataFromIndexedDB(STORES.SETTINGS);
                        data = settingsData ? settingsData[key] : null;
                    } else {
                        const settingsData = await loadDataFromIndexedDB(STORES.SETTINGS);
                        data = settingsData ? settingsData[key] : null;
                    }
                    
                    // 如果IndexedDB中没有，尝试从localStorage迁移
                    if (data === null) {
                        const localStorageData = localStorage.getItem(key);
                        if (localStorageData !== null) {
                            console.log(`从localStorage迁移数据: ${key}`);
                            data = localStorageData;
                            
                            // 保存到IndexedDB
                            await setItem(key, data);
                            
                            // 从localStorage删除
                            localStorage.removeItem(key);
                        }
                    }
                    
                    return data !== null ? data : defaultValue;
                } catch (error) {
                    console.error(`获取数据出错 (${key}):`, error);
                    // 出错时尝试从localStorage获取
                    return localStorage.getItem(key) || defaultValue;
                }
            }
            
            // 替换localStorage.setItem
            async function setItem(key, value) {
                try {
                    // 根据key类型选择合适的存储
                    if (key.includes('weather')) {
                        // 天气数据
                        const weatherData = await loadDataFromIndexedDB(STORES.WEATHER) || {};
                        weatherData[key] = value;
                        await saveDataToIndexedDB(STORES.WEATHER, weatherData);
                    } else if (key.includes('custom-icon')) {
                        // 自定义图标
                        const appName = key.replace('custom-icon-', '');
                        await saveDataToIndexedDB(STORES.CUSTOM_ICONS, { icon: value }, appName);
                    } else if (key.includes('music')) {
                        // 音乐数据
                        const musicData = await loadDataFromIndexedDB(STORES.MUSIC) || {};
                        musicData[key] = value;
                        await saveDataToIndexedDB(STORES.MUSIC, musicData);
                    } else if (key.includes('assistiveTouch')) {
                        // 辅助触控设置
                        const settingsData = await loadDataFromIndexedDB(STORES.SETTINGS) || {};
                        settingsData[key] = value;
                        await saveDataToIndexedDB(STORES.SETTINGS, settingsData);
                    } else {
                        // 其他设置
                        const settingsData = await loadDataFromIndexedDB(STORES.SETTINGS) || {};
                        settingsData[key] = value;
                        await saveDataToIndexedDB(STORES.SETTINGS, settingsData);
                    }
                    
                    console.log(`数据保存成功: ${key}`);
                } catch (error) {
                    console.error(`保存数据出错 (${key}):`, error);
                    // 出错时回退到localStorage
                    localStorage.setItem(key, value);
                }
            }
            
            // 替换localStorage.removeItem
            async function removeItem(key) {
                try {
                    // 根据key类型选择合适的存储
                    if (key.includes('custom-icon')) {
                        const appName = key.replace('custom-icon-', '');
                        await deleteDataFromIndexedDB(STORES.CUSTOM_ICONS, appName);
                    } else if (key.includes('weather')) {
                        const weatherData = await loadDataFromIndexedDB(STORES.WEATHER) || {};
                        delete weatherData[key];
                        await saveDataToIndexedDB(STORES.WEATHER, weatherData);
                    } else if (key.includes('music')) {
                        const musicData = await loadDataFromIndexedDB(STORES.MUSIC) || {};
                        delete musicData[key];
                        await saveDataToIndexedDB(STORES.MUSIC, musicData);
                    } else {
                        const settingsData = await loadDataFromIndexedDB(STORES.SETTINGS) || {};
                        delete settingsData[key];
                        await saveDataToIndexedDB(STORES.SETTINGS, settingsData);
                    }
                    
                    console.log(`数据删除成功: ${key}`);
                } catch (error) {
                    console.error(`删除数据出错 (${key}):`, error);
                    // 出错时回退到localStorage
                    localStorage.removeItem(key);
                }
            }
            
            // 保存微信数据到IndexedDB
            let saveWechatDataTimeout = null;
            async function saveWechatData() {
                if (saveWechatDataTimeout) clearTimeout(saveWechatDataTimeout);
                
                return new Promise((resolve) => {
                    saveWechatDataTimeout = setTimeout(async () => {
                        try {
                            const dataToSave = {
                                characters: wechatState.characters,
                                profile: wechatState.profile,
                                moments: wechatState.moments,
                                momentsCover: wechatState.momentsCover,
                                settings: wechatState.settings,
                                groups: wechatState.groups || []
                            };
                            
                            // 保存到IndexedDB
                            await saveDataToIndexedDB(STORES.APP_DATA, dataToSave, 'wechatAppState');
                            console.log('微信数据保存成功 (已防抖)');
                            resolve(true);
                        } catch (error) {
                            console.error('保存微信数据失败:', error);
                            resolve(false);
                        }
                    }, 500); // 500ms 防抖
                });
            }

            // 更新朋友圈背景图片
            function updateMomentsCover() {
                const momentsCover = document.getElementById('moments-cover');
                if (momentsCover) {
                    if (wechatState.momentsCover) {
                        momentsCover.style.background = `url('${wechatState.momentsCover}') center/cover no-repeat`;
                    } else {
                        momentsCover.style.background = '#2c2c2e';
                    }
                }
            }

            // 初始化朋友圈背景图片上传功能
            function initMomentsCoverUpload() {
                const momentsCover = document.getElementById('moments-cover');
                const momentsCoverInput = document.getElementById('moments-cover-input');
                
                if (momentsCover && momentsCoverInput) {
                    // 点击背景图片打开发布模态框
                    momentsCover.addEventListener('click', () => {
                        momentsCoverInput.click();
                    });
                    
                    // 处理文件选择
                    momentsCoverInput.addEventListener('change', (e) => {
                        const file = e.target.files[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                                // 保存背景图片到wechatState
                                wechatState.momentsCover = event.target.result;
                                // 更新背景图片显示
                                updateMomentsCover();
                                // 保存数据到localStorage
                                saveWechatData();
                            };
                            reader.readAsDataURL(file);
                        }
                    });
                }
            }

            function applyWechatTheme() {
                const appWechat = document.getElementById('app-wechat');
                if (!appWechat) return;

                // 处理自定义主页面底图
                const mainBg = localStorage.getItem('wechatMainBg');
                const wechatContent = appWechat.querySelector('.wechat-content');
                
                // 获取各个标签页容器
                const chatList = appWechat.querySelector('.wechat-chat-list');
                const contactsContent = appWechat.querySelector('.wechat-contacts-content');
                const momentsContent = appWechat.querySelector('.wechat-moments-content');
                const meContent = appWechat.querySelector('.wechat-me-content');
                
                if (mainBg && wechatContent) {
                    wechatContent.style.backgroundImage = `url('${mainBg}')`;
                    wechatContent.style.backgroundSize = 'cover';
                    wechatContent.style.backgroundPosition = 'center';
                    
                    // 让子容器透明以显示底图
                    if (chatList) chatList.style.background = 'transparent';
                    if (contactsContent) contactsContent.style.background = 'transparent';
                    if (momentsContent) momentsContent.style.background = 'transparent';
                    if (meContent) meContent.style.background = 'transparent';
                } else {
                    if (wechatContent) wechatContent.style.backgroundImage = '';
                    
                    // 恢复默认背景色
                    if (chatList) chatList.style.background = 'var(--bg-color)';
                    if (contactsContent) contactsContent.style.background = 'var(--bg-color)';
                    if (momentsContent) momentsContent.style.background = 'var(--bg-color)';
                    if (meContent) meContent.style.background = 'var(--bg-color)';
                }

                // 处理自定义聊天背景
                const chatBg = localStorage.getItem('wechatChatBg');
                const chatMessagesContainer = document.getElementById('wechat-messages');
                if (chatBg && chatMessagesContainer) {
                    chatMessagesContainer.style.backgroundImage = `url('${chatBg}')`;
                    chatMessagesContainer.style.backgroundSize = 'cover';
                    chatMessagesContainer.style.backgroundPosition = 'center';
                } else if (chatMessagesContainer) {
                    chatMessagesContainer.style.backgroundImage = '';
                }

                // 不重置 className，只设置 data-theme 属性
                appWechat.setAttribute('data-theme', wechatState.settings.theme);
                
                appWechat.style.setProperty('--bg-color', '#f4f4f9');
                appWechat.style.setProperty('--text-color', '#2c2c2e');
                appWechat.style.setProperty('--secondary-text-color', '#6a6a6e');
                appWechat.style.setProperty('--border-color', '#e5e5e5');
                
                // 重置为默认样式
                resetWechatStyles(appWechat);
            }
            
            function resetWechatStyles(appWechat) {
                // 重置聊天视图的样式
                const chatView = document.getElementById('wechat-chat-view');
                if (chatView) {
                    chatView.style.background = '#f2f2f7';
                }
                
                // 重置聊天头部的样式
                const chatHeader = appWechat.querySelector('.wechat-chat-header');
                if (chatHeader) {
                    chatHeader.style.background = '#ffffff';
                    chatHeader.style.borderBottomColor = 'rgba(0, 0, 0, 0.03)';
                }
                
                // 重置消息气泡的样式
                const aiBubbles = appWechat.querySelectorAll('.wechat-message.ai .wechat-message-bubble');
                aiBubbles.forEach(bubble => {
                    bubble.style.background = '#ffffff';
                    bubble.style.color = 'var(--text-color)';
                });
                
                const userBubbles = appWechat.querySelectorAll('.wechat-message.user .wechat-message-bubble');
                userBubbles.forEach(bubble => {
                    bubble.style.background = '#2c2c2e';
                    bubble.style.color = '#ffffff';
                });
                
                // 重置聊天项的样式
                const chatItems = appWechat.querySelectorAll('.wechat-chat-item');
                chatItems.forEach(item => {
                    item.style.background = 'rgba(255, 255, 255, 0.7)';
                    item.style.borderBottomColor = 'rgba(229, 229, 229, 0.3)';
                    item.style.backdropFilter = 'blur(20px)';
                    item.style.webkitBackdropFilter = 'blur(20px)';
                    item.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
                });
                
                // 重置聊天项悬停的样式
                appWechat.querySelectorAll('.wechat-chat-item:hover').forEach(item => {
                    item.style.background = 'rgba(255, 255, 255, 0.85)';
                    item.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                });
                
                // 重置聊天项文字的样式
                const chatNames = appWechat.querySelectorAll('.wechat-chat-name');
                chatNames.forEach(name => {
                    name.style.color = 'var(--text-color)';
                });
                
                const chatPreviews = appWechat.querySelectorAll('.wechat-chat-preview');
                chatPreviews.forEach(preview => {
                    preview.style.color = '#8e8e93';
                });
                
                const chatTimes = appWechat.querySelectorAll('.wechat-chat-time');
                chatTimes.forEach(time => {
                    time.style.color = '#8e8e93';
                });
            }
            
            // 渲染个人资料到页面
            // 渲染头像的通用函数，解决“图片裂开”问题
            function renderAvatarHtml(url, className = '') {
                const hasAvatar = url && url !== '' && url !== GREY_AVATAR;
                // 为不同类型的头像提供默认背景色
                let defaultBg = '#f0f0f2';
                if (className.includes('contact')) defaultBg = '#f0f0f2';
                if (className.includes('chat')) defaultBg = '#fff';
                
                // 判断是否是群组头像占位符
                const isGroup = className.includes('group');
                const placeholderIcon = isGroup ? 'fas fa-users' : 'fas fa-user';

                if (hasAvatar) {
                    return `
                        <div class="${className}-wrapper avatar-wrapper" style="position: relative; width: 100%; height: 100%; border-radius: inherit; overflow: hidden; background-color: ${defaultBg};">
                            <img src="${url}" class="${className}" style="width: 100%; height: 100%; object-fit: cover; display: block;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div class="${className} avatar-placeholder" style="display:none; position: absolute; top:0; left:0; width: 100%; height: 100%; background-color: ${defaultBg}; align-items: center; justify-content: center; color: #c7c7cc; border-radius: inherit;">
                                <i class="${placeholderIcon}"></i>
                            </div>
                        </div>`;
                } else {
                    return `
                        <div class="${className} avatar-placeholder" style="background-color: ${defaultBg}; display: flex; align-items: center; justify-content: center; color: #c7c7cc; width: 100%; height: 100%; border-radius: inherit;">
                            <i class="${placeholderIcon}" style="font-size: 0.5em;"></i>
                        </div>`;
                }
            }

            function renderAvatarInto(container, url, className = '') {
                if (!container) return;
                container.innerHTML = renderAvatarHtml(url, className);
            }

            function renderWechatProfile() {
                const profileName = document.querySelector('.wechat-profile-name');
                const profileDesc = document.querySelector('.wechat-profile-desc');
                const profileAvatarDisplay = document.getElementById('wechat-profile-avatar-display');
                const momentsProfileAvatar = document.getElementById('moments-profile-avatar');
                
                if (profileName) {
                    profileName.textContent = wechatState.profile.nickname;
                }
                
                if (profileDesc) {
                    profileDesc.textContent = `微信号: ${wechatState.profile.wechatid}`;
                }
                
                const avatarUrl = wechatState.profile.avatar;
                
                // 更新个人资料头像
                renderAvatarInto(profileAvatarDisplay, avatarUrl, 'wechat-profile-avatar-media');
                
                // 更新朋友圈顶部封面头像
                renderAvatarInto(momentsProfileAvatar, avatarUrl, 'moments-profile-avatar-media');
                
                const momentsProfileName = document.getElementById('moments-profile-name');
                if (momentsProfileName) {
                    momentsProfileName.textContent = wechatState.profile.nickname;
                }
            }

            function renderWechatList() {
                const listView = document.getElementById('wechat-list-view');
                if (!listView) return;

                const now = new Date();
                const timeString = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

                // 合并角色和群组列表
                const chatList = [
                    ...wechatState.characters.map(c => ({ ...c, type: 'single' })),
                    ...(wechatState.groups || []).map(g => ({ ...g, type: 'group' }))
                ];

                // 排序：置顶的在前，然后按最后一条消息时间（这里简化为保持原有排序或按最后消息，目前主要处理显示）
                chatList.sort((a, b) => {
                    if (a.pinned && !b.pinned) return -1;
                    if (!a.pinned && b.pinned) return 1;
                    return 0;
                });

                listView.innerHTML = chatList.map(item => {
                    const lastMessage = item.chatHistory[item.chatHistory.length - 1];
                    const previewText = lastMessage ? lastMessage.content.substring(0, 20) + (lastMessage.content.length > 20 ? '...' : '') : '开始聊天吧~';
                    const isPinned = item.pinned || false;
                    const avatar = item.type === 'group' ? (item.avatar || 'https://image-1306385190.cos.ap-nanjing.myqcloud.com/gpt/avatar_group.png') : item.avatar;
                    const name = item.type === 'group' ? `${item.name}(${item.members.length})` : item.name;

                    return `
                        <div class="wechat-chat-item" data-id="${item.id}" data-type="${item.type}" ${isPinned ? 'data-pinned="true"' : ''}>
                            <div class="wechat-chat-item-content">
                                <div class="wechat-chat-avatar-container">
                                    ${renderAvatarHtml(avatar, 'wechat-chat-avatar')}
                                </div>
                                <div class="wechat-chat-content">
                                    <div class="wechat-chat-item-header">
                                        <span class="wechat-chat-name">${name}${isPinned ? ' <i class="fas fa-thumbtack" style="font-size: 12px; color: #8e8e93;"></i>' : ''}</span>
                                        <span class="wechat-chat-time">${timeString}</span>
                                    </div>
                                    <div class="wechat-chat-preview">${previewText}</div>
                                </div>
                            </div>
                            <div class="wechat-chat-item-actions">
                                <button class="wechat-action-btn wechat-pin-btn">${isPinned ? '取消置顶' : '置顶'}</button>
                            </div>
                        </div>
                    `;
                }).join('');

                // 绑定点击事件
                listView.querySelectorAll('.wechat-chat-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const id = item.dataset.id;
                        const type = item.dataset.type;
                        openWechatChat(id, type);
                    });

                    // 添加左滑手势
                    let startX = 0;
                    let startY = 0;
                    let isDragging = false;

                    item.addEventListener('touchstart', (e) => {
                        startX = e.touches[0].clientX;
                        startY = e.touches[0].clientY;
                        isDragging = false;
                    }, { passive: true });

                    item.addEventListener('touchmove', (e) => {
                        const currentX = e.touches[0].clientX;
                        const currentY = e.touches[0].clientY;
                        const diffX = startX - currentX;
                        const diffY = Math.abs(startY - currentY);

                        // 只处理水平滑动，且滑动距离大于30px
                        if (diffX > 30 && diffY < 50) {
                            isDragging = true;
                            e.preventDefault();
                            // 显示操作按钮
                            const actions = item.querySelector('.wechat-chat-item-actions');
                            if (actions) {
                                actions.style.transform = `translateX(-${Math.min(diffX, 80)}px)`;
                            }
                        }
                    }, { passive: false });

                    item.addEventListener('touchend', (e) => {
                        const currentX = e.changedTouches[0].clientX;
                        const diffX = startX - currentX;

                        if (isDragging && diffX > 50) {
                            // 显示操作按钮
                            const actions = item.querySelector('.wechat-chat-item-actions');
                            if (actions) {
                                actions.style.transform = 'translateX(-80px)';
                            }
                        } else {
                            // 隐藏操作按钮
                            const actions = item.querySelector('.wechat-chat-item-actions');
                            if (actions) {
                                actions.style.transform = 'translateX(0)';
                            }
                        }
                    }, { passive: true });

                    // 绑定置顶按钮事件
                    const pinBtn = item.querySelector('.wechat-pin-btn');
                    if (pinBtn) {
                        pinBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const charId = parseInt(item.dataset.charId);
                            toggleWechatPin(charId);
                        });
                    }
                });
            }

            function toggleWechatPin(charId) {
                const charIndex = wechatState.characters.findIndex(c => c.id === charId);
                if (charIndex === -1) return;

                const char = wechatState.characters[charIndex];
                char.pinned = !char.pinned;

                // 重新排序，置顶的角色放在前面
                wechatState.characters.sort((a, b) => {
                    if (a.pinned && !b.pinned) return -1;
                    if (!a.pinned && b.pinned) return 1;
                    return 0;
                });

                // 保存数据
                saveWechatData();
                // 重新渲染列表
                renderWechatList();
            }

            function openWechatChat(id, type = 'single') {
                wechatState.activeChatId = id;
                wechatState.activeChatType = type;
                
                let target;
                if (type === 'single') {
                    target = wechatState.characters.find(c => c.id == id);
                } else {
                    target = (wechatState.groups || []).find(g => g.id == id);
                }
                
                if (!target) return;

                document.getElementById('wechat-list-view').style.display = 'none';
                document.getElementById('wechat-chat-view').classList.add('active');
                
                document.getElementById('wechat-current-name').textContent = target.name || target.nickname;

                // 隐藏底部导航栏
                const wechatNav = document.querySelector('.wechat-nav');
                if (wechatNav) wechatNav.style.display = 'none';

                // 清空顶部的标题并隐藏加号按钮
                document.getElementById('wechat-header-title').textContent = '';
                const wechatPlusBtn = document.getElementById('wechat-plus-btn');
                if (wechatPlusBtn) wechatPlusBtn.style.display = 'none';

                renderWechatMessages(target);
            }

            function closeWechatChat() {
                document.getElementById('wechat-list-view').style.display = 'block';
                document.getElementById('wechat-chat-view').classList.remove('active');
                wechatState.activeChatId = null;
                wechatState.activeChatType = 'single';
                wechatState.conversationTurns = 0;
                
                // 显示底部导航栏
                const wechatNav = document.querySelector('.wechat-nav');
                if (wechatNav) wechatNav.style.display = 'flex';

                // 恢复顶部的标题和加号按钮
                document.getElementById('wechat-header-title').textContent = '微信';
                const wechatPlusBtn = document.getElementById('wechat-plus-btn');
                if (wechatPlusBtn) wechatPlusBtn.style.display = 'flex';

                renderWechatList();
            }

            // 绑定聊天页返回按钮，避免与头部返回按钮的选择器冲突
            document.getElementById('wechat-chat-back-btn')?.addEventListener('click', closeWechatChat);

            function renderWechatMessages(target) {
                const messageList = document.getElementById('wechat-messages');
                messageList.innerHTML = '';

                const isGroup = wechatState.activeChatType === 'group';

                target.chatHistory.forEach(msg => {
                    if (isGroup) {
                        addWechatMessage(msg.content, msg.role, msg.avatar, msg.nickname);
                    } else {
                        addWechatMessage(msg.content, msg.role, target.avatar);
                    }
                });
                
                if (target.isTyping) {
                    showWechatTyping(target);
                }
            }

            function escapeHtml(text) {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }

            function addWechatMessage(content, role, avatar, nickname = null) {
                const messageList = document.getElementById('wechat-messages');
                if (!messageList) return;
                
                const div = document.createElement('div');
                
                // 判断是否是特殊 HTML 内容（如红包、转账、图片）
                const trimmedContent = content.trim();
                const isHtml = trimmedContent.startsWith('<div') || trimmedContent.startsWith('<img');
                const finalContent = isHtml ? content : escapeHtml(content);

                // 将 assistant 映射为 ai 以便使用现有 CSS
                const displayRole = role === 'assistant' ? 'ai' : role;

                if (displayRole === 'system') {
                    div.className = 'wechat-message';
                    div.style.alignSelf = 'center';
                    div.innerHTML = `
                        <div class="wechat-message-bubble" style="background: rgba(255, 255, 255, 0.8); color: var(--secondary-text-color); font-size: 12px; padding: 6px 12px; border-radius: 12px;">
                            ${finalContent}
                        </div>
                    `;
                } else {
                    div.className = `wechat-message ${displayRole}`;
                    const avatarUrl = displayRole === 'ai' ? avatar : (wechatState.profile.avatar || 'https://image-1306385190.cos.ap-nanjing.myqcloud.com/gpt/avatar_user.png');
                    
                    // 如果是红包或转账，气泡背景设为透明，因为自带背景
                    const isSpecial = content.includes('wechat-redpacket') || content.includes('wechat-transfer');
                    const bubbleStyle = isSpecial ? 'background: transparent; box-shadow: none; padding: 0;' : '';
                    
                    // 群聊显示昵称
                    const nicknameHtml = (nickname && wechatState.activeChatType === 'group' && displayRole === 'ai') 
                        ? `<div class="wechat-msg-nickname">${nickname}</div>` 
                        : '';

                    div.innerHTML = `
                        <div class="wechat-message-avatar-container">
                            ${renderAvatarHtml(avatarUrl, 'wechat-message-avatar')}
                        </div>
                        <div class="wechat-msg-content-wrapper">
                            ${nicknameHtml}
                            <div class="wechat-message-bubble ${isSpecial ? 'no-bg' : ''}" style="${bubbleStyle}">${finalContent}</div>
                        </div>
                    `;
                }

                messageList.appendChild(div);
                messageList.scrollTop = messageList.scrollHeight;
            }

            function showWechatTyping(char) {
                if (wechatState.activeCharacterId !== char.id) return;
                
                // 将顶部的名字替换为“对方正在输入...”
                const nameEl = document.getElementById('wechat-current-name');
                if (nameEl) {
                    nameEl.textContent = '对方正在输入...';
                }
            }

            function removeWechatTyping() {
                // 恢复顶部的名字显示
                if (wechatState.activeCharacterId) {
                    const char = wechatState.characters.find(c => c.id == wechatState.activeCharacterId);
                    if (char) {
                        const nameEl = document.getElementById('wechat-current-name');
                        if (nameEl) {
                            nameEl.textContent = char.name;
                        }
                    }
                }
            }

            // 显示全局通知弹窗
            function showGlobalNotification(title, text, iconUrl, onClick) {
                // 如果已经有通知，先移除
                const existingNotification = document.getElementById('ios-global-notification');
                if (existingNotification) {
                    existingNotification.remove();
                }

                const notification = document.createElement('div');
                notification.id = 'ios-global-notification';
                notification.className = 'ios-notification';
                
                notification.innerHTML = `
                    <img src="${iconUrl}" class="ios-notification-icon">
                    <div class="ios-notification-content">
                        <div class="ios-notification-header">
                            <span class="ios-notification-title">${title}</span>
                            <span class="ios-notification-app">微信</span>
                        </div>
                        <div class="ios-notification-text">${text}</div>
                    </div>
                `;

                // 点击通知的处理
                notification.addEventListener('click', () => {
                    notification.classList.remove('show');
                    setTimeout(() => notification.remove(), 500);
                    if (onClick) onClick();
                });

                document.getElementById('phone-ui-container').appendChild(notification);

                // 强制重绘后添加 show 类以触发动画
                notification.offsetHeight;
                notification.classList.add('show');

                // 3秒后自动消失
                setTimeout(() => {
                    if (document.body.contains(notification)) {
                        notification.classList.remove('show');
                        setTimeout(() => {
                            if (document.body.contains(notification)) {
                                notification.remove();
                            }
                        }, 500);
                    }
                }, 3000);
            }

            // 分句发送消息，模拟真人对话
            async function sendWechatMessageBySentences(text, char) {
                // 使用更智能的分段方式，保留原有的标点符号
                // 匹配段落或长句结尾的标点（如句号、叹号、问号、省略号），并且保留这些标点
                const regex = /([^。！？.!?…]+[。！？.!?…]+)/g;
                let segments = text.match(regex);
                
                // 如果没有匹配到长句标点，或者文本很短，就整体作为一段
                if (!segments || segments.length === 0) {
                    segments = [text];
                } else {
                    // 处理末尾没有标点的残留文本
                    const joinedSegments = segments.join('');
                    if (joinedSegments.length < text.length) {
                        segments.push(text.substring(joinedSegments.length));
                    }
                }
                
                // 过滤掉空白段落
                segments = segments.map(s => s.trim()).filter(s => s.length > 0);
                
                // 逐段发送
                for (let i = 0; i < segments.length; i++) {
                    const segment = segments[i];
                    
                    // 记录到历史中，这样重新加载时就不会合并成一句话了
                    char.chatHistory.push({ role: 'assistant', content: segment });
                    saveWechatData();
                    
                    // 发送当前段落 (只在当前聊天活跃时渲染)
                    if (wechatState.activeCharacterId == char.id) {
                        addWechatMessage(segment, 'ai', char.avatar);
                    }
                    
                    // 检查是否需要显示全局通知弹窗
                    const wechatApp = document.getElementById('app-wechat');
                    const isWechatOpen = wechatApp && wechatApp.classList.contains('active');
                    const isChatViewOpen = document.getElementById('wechat-chat-view').classList.contains('active');
                    
                    // 只有在不在当前聊天窗口时才显示通知
                    const isCurrentlyInThisChat = isWechatOpen && isChatViewOpen && wechatState.activeCharacterId == char.id;

                    if (!isCurrentlyInThisChat) {
                        showGlobalNotification(char.name, segment, char.avatar, () => {
                            if (!isWechatOpen) openApp('wechat');
                            openWechatChat(char.id, 'single');
                        });
                    }
                    
                    // 如果不是最后一段，添加打字指示器并等待
                    if (i < segments.length - 1) {
                        char.isTyping = true;
                        if (wechatState.activeCharacterId === char.id) {
                            showWechatTyping(char);
                        }
                        // 等待时间根据段落长度和随机因素决定，模拟真人打字停顿
                        const waitTime = Math.max(800, segment.length * 40 + Math.random() * 800);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        if (wechatState.activeCharacterId === char.id) {
                            removeWechatTyping();
                        }
                    }
                }
                
                renderWechatList();
                char.isTyping = false;
                return segments;
            }

            // 读取其他应用的数据
            function getOtherAppData() {
                let appData = [];
                
                // 读取备忘录数据
                try {
                    const notesData = localStorage.getItem('ios-notes');
                    if (notesData) {
                        const notes = JSON.parse(notesData);
                        if (notes.length > 0) {
                            // 按更新时间排序并取最近5条
                            const recentNotes = notes
                                .sort((a, b) => b.updatedAt - a.updatedAt)
                                .slice(0, 5)
                                .map(n => `【${new Date(n.updatedAt).toLocaleDateString()}】${n.content.substring(0, 50)}${n.content.length > 50 ? '...' : ''}`)
                                .join(' | ');
                            
                            appData.push({
                                app: '备忘录',
                                data: '最近的备忘录内容：' + recentNotes
                            });
                        }
                    }
                } catch (error) {
                    console.error('读取备忘录数据失败:', error);
                }

                // 读取计算器历史
                try {
                    const calculatorHistory = localStorage.getItem('calculatorHistory');
                    if (calculatorHistory) {
                        const history = JSON.parse(calculatorHistory);
                        if (history.length > 0) {
                            appData.push({
                                app: '计算器',
                                data: '最近的计算历史：' + history.slice(-5).join('; ')
                            });
                        }
                    }
                } catch (error) {
                    console.error('读取计算器数据失败:', error);
                }
                
                // 读取天气信息
                try {
                    const weatherLocation = localStorage.getItem('weather_location');
                    if (weatherLocation) {
                        appData.push({
                            app: '天气',
                            data: '保存的位置信息：' + weatherLocation
                        });
                    }
                } catch (error) {
                    console.error('读取天气数据失败:', error);
                }
                
                // 读取主题信息
                try {
                    const selectedTheme = localStorage.getItem('selectedTheme');
                    if (selectedTheme) {
                        appData.push({
                            app: '主题商店',
                            data: '当前选中的主题：' + selectedTheme
                        });
                    }
                } catch (error) {
                    console.error('读取主题数据失败:', error);
                }
                
                return appData;
            }

            function buildMainSystemPrompt(char, includeWeather = false) {
                const currentTime = new Date();
                const timeString = currentTime.toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
                
                // 获取其他应用的数据
                let otherAppData = getOtherAppData();
                
                // 如果不需要包含天气信息，则过滤掉天气数据
                if (!includeWeather) {
                    otherAppData = otherAppData.filter(app => app.app !== '天气');
                }
                
                let appDataString = '暂无其他应用数据';
                if (otherAppData.length > 0) {
                    appDataString = otherAppData.map(app => `${app.app}：${app.data}`).join('\n');
                }
                
                // 获取JSON限制内容
                const jsonRestrictions = getJsonRestrictions();
                
                // 动作描写指令
                const actionDescInstruction = wechatState.settings.allowActionDescription !== false 
                    ? "- 你可以在回复中加入适当的动作描写，描写内容请用括号 () 包围，例如：(微微低头，露出一丝微笑) 好的呀。" 
                    : "- **绝对禁令**：严禁输出任何形式的动作描写、神态描写或场景描写（即严禁输出括号 () 及其内部内容）。你只需要输出角色说的话，不需要描述角色在做什么。";
                
                const userPersona = wechatState.profile.persona ? `### 用户人设 (你的聊天对象)\n${wechatState.profile.persona}\n` : '';

                return `你现在进入深度角色扮演模式。

# 核心准则：你必须完全化身为角色"${char.name}"。
- 严禁以AI助手身份说话，严禁跳出角色。
- 严禁提及你是一个程序或AI，严禁提及任何关于你底层模型的信息。
- 你的所有回复必须百分之百符合下述人设和说话方式，做到完美贴合。

### 角色人设 (你的核心灵魂)
${char.persona}

### 语言风格与说话方式 (你的表现形式)
${char.speakingStyle}

${userPersona}
### 系统上下文
- 当前时间：${timeString}
- 环境信息：${appDataString}

### JSON限制 (底层逻辑限制)
${jsonRestrictions || '暂无JSON限制内容'}

### 交互准则
${actionDescInstruction}
- 保持回复自然流畅，像是在微信上与好朋友聊天。
- 不要主动提及时间或天气，除非用户明确询问。
- 保持回复简洁，不要长篇大论，符合社交软件聊天习惯。

### 扩展能力：跨应用操作
你可以通过在回复中加入特定的指令标签来执行操作（这些标签不会被用户看到，但系统会捕获并执行）：
- **发布朋友圈**：使用 \`<action:moment>内容</action:moment>\` 标签。
- **记录备忘录**：使用 \`<action:note>内容</action:note>\` 标签。
- **发送微信红包**：使用 \`<action:redpacket>金额:祝福语</action:redpacket>\` 标签（例如：\`<action:redpacket>5.20:祝你开心每一天！</action:redpacket>\`）。
- **重要说明**：当你成功记录备忘录或发布朋友圈后，系统会自动在对话框中生成一条提示词（如“已为你记录备忘录：...”），因此你不需要在回复中再次重复说明“我已经帮你记好了”之类的话，直接以角色的口吻继续聊天即可。当发送红包时，你只需说相关的聊天内容即可，系统会自动帮你发送红包。
- 你可以根据对话上下文自主决定何时使用这些功能。

### 关于用户的长期记忆
${Array.isArray(char.memory) ? char.memory.map((m, i) => `${i+1}. ${m}`).join('\n') : (char.memory || '暂无记忆')}`.trim();
            }
            
            // 获取JSON限制内容
            function getJsonRestrictions() {
                const jsonRestrictions = localStorage.getItem('jsonRestrictions');
                return jsonRestrictions || '';
            }

            function buildMemorySummarizePrompt(char, recentHistory) {
                return `# 指令：你是记忆总结助手。阅读"当前记忆"和"近期对话"，输出"更新后的记忆"。
请将更新后的记忆整理成独立的条目，并且**必须以纯JSON数组的格式返回**（例如：["记忆1", "记忆2"]），不要包含任何其他文字、解释或Markdown标记。

## 当前记忆
${Array.isArray(char.memory) ? JSON.stringify(char.memory) : JSON.stringify([char.memory || ''])}

## 近期对话
${recentHistory.map(m => `${m.role}: ${m.content}`).join('\n')}

## 更新后的记忆 (JSON数组)`.trim();
            }

            async function processAIAction(reply, char) {
                if (!reply) return reply;

                // 处理备忘录
                const noteRegex = /<action:note>([\s\S]*?)<\/action:note>/g;
                let noteMatch;
                while ((noteMatch = noteRegex.exec(reply)) !== null) {
                    const originalContent = noteMatch[1].trim();
                    if (originalContent) {
                        try {
                            const notesData = localStorage.getItem('ios-notes');
                            let notes = notesData ? JSON.parse(notesData) : [];
                            const now = Date.now();
                            const contentWithSignature = `${originalContent}\n\n—— 来自角色: ${char.name}`;
                            notes.push({
                                id: 'note_' + now + '_' + Math.random().toString(36).substr(2, 5),
                                content: contentWithSignature,
                                createdAt: now,
                                updatedAt: now,
                                createdBy: char.name
                            });
                            localStorage.setItem('ios-notes', JSON.stringify(notes));
                            if (typeof loadNotes === 'function') loadNotes();
                            
                            // 在对话中展示提示词
                            if (wechatState.activeCharacterId === char.id) {
                                addWechatMessage(`已为你记录备忘录：${originalContent.substring(0, 20)}${originalContent.length > 20 ? '...' : ''}`, 'system', char.avatar);
                            }
                            
                            console.log(`AI角色 ${char.name} 写入了备忘录`);
                        } catch (e) {
                            console.error('AI写入备忘录失败:', e);
                        }
                    }
                }

                // 处理朋友圈
                const momentRegex = /<action:moment>([\s\S]*?)<\/action:moment>/g;
                let momentMatch;
                while ((momentMatch = momentRegex.exec(reply)) !== null) {
                    const content = momentMatch[1].trim();
                    if (content) {
                        try {
                            const newMoment = {
                                id: Date.now() + Math.random(),
                                userId: 'char_' + char.id,
                                userName: char.name,
                                avatar: char.avatar,
                                content: content,
                                images: [],
                                video: null,
                                location: null,
                                timestamp: Date.now(),
                                likes: [],
                                comments: []
                            };
                            wechatState.moments.unshift(newMoment);
                            await saveWechatData();
                            if (typeof renderWechatMoments === 'function') renderWechatMoments();
                            
                            // 在对话中展示提示词
                            if (wechatState.activeCharacterId === char.id) {
                                addWechatMessage(`已为你发布朋友圈：${content.substring(0, 20)}${content.length > 20 ? '...' : ''}`, 'system', char.avatar);
                            }
                            
                            console.log(`AI角色 ${char.name} 发布了朋友圈`);
                        } catch (e) {
                            console.error('AI发布朋友圈失败:', e);
                        }
                    }
                }

                // 处理发送红包
                const rpRegex = /<action:redpacket>([\s\S]*?)<\/action:redpacket>/g;
                let rpMatch;
                while ((rpMatch = rpRegex.exec(reply)) !== null) {
                    const content = rpMatch[1].trim();
                    if (content) {
                        try {
                            const parts = content.split(':');
                            const amount = parseFloat(parts[0]) || 10;
                            const msg = parts[1] ? parts.slice(1).join(':').trim() : '恭喜发财，大吉大利';
                            const rpId = 'rp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
                            
                            const redpacketContent = `
                                <div class="wechat-redpacket" data-id="${rpId}" data-amount="${amount.toFixed(2)}" data-msg="${msg}" data-sender="ai">
                                    <div class="wechat-redpacket-top">
                                        <div class="wechat-redpacket-icon"></div>
                                        <div class="wechat-redpacket-info">
                                            <div class="wechat-redpacket-msg">${msg}</div>
                                            <div class="wechat-redpacket-status">领取红包</div>
                                        </div>
                                    </div>
                                    <div class="wechat-redpacket-bottom">微信红包</div>
                                </div>
                            `;
                            
                            // 直接插入红包消息到聊天记录中
                            if (wechatState.activeCharacterId === char.id) {
                                addWechatMessage(redpacketContent, 'ai', char.avatar);
                            }
                            char.chatHistory.push({ role: 'ai', content: redpacketContent });
                            saveWechatData();
                            
                            console.log(`AI角色 ${char.name} 发送了红包: ${amount}`);
                        } catch (e) {
                            console.error('AI发送红包失败:', e);
                        }
                    }
                }

                // 处理发送转账
                const transferRegex = /<action:transfer>([\s\S]*?)<\/action:transfer>/g;
                let transferMatch;
                while ((transferMatch = transferRegex.exec(reply)) !== null) {
                    const content = transferMatch[1].trim();
                    if (content) {
                        try {
                            const parts = content.split(':');
                            const amount = parseFloat(parts[0]) || 10;
                            const remark = parts[1] ? parts.slice(1).join(':').trim() : '';
                            const transferId = 'tf_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
                            
                            const transferContent = `
                                <div class="wechat-transfer" data-id="${transferId}" data-amount="${amount.toFixed(2)}" data-sender="ai">
                                    <div class="transfer-main">
                                        <div class="transfer-icon"><i class="fas fa-exchange-alt"></i></div>
                                        <div class="transfer-text">
                                            <div class="transfer-amount">¥${amount.toFixed(2)}</div>
                                            <div class="transfer-status">微信转账</div>
                                        </div>
                                    </div>
                                    <div class="transfer-footer">微信支付</div>
                                </div>
                            `;
                            
                            // 直接插入转账消息到聊天记录中
                            if (wechatState.activeCharacterId === char.id) {
                                addWechatMessage(transferContent, 'ai', char.avatar);
                            }
                            char.chatHistory.push({ role: 'ai', content: transferContent });
                            saveWechatData();
                            
                            console.log(`AI角色 ${char.name} 发送了转账: ${amount}`);
                        } catch (e) {
                            console.error('AI发送转账失败:', e);
                        }
                    }
                }

                // 移除回复中的 action 标签，避免显示给用户
                return reply.replace(/<action:.*?>[\s\S]*?<\/action:.*?>/g, '').trim();
            }

            // --- 群聊功能实现 ---
            let selectedMemberIds = [];

            window.openCreateGroupModal = function() {
                const modal = document.getElementById('wechat-create-group-modal');
                if (!modal) return;
                
                selectedMemberIds = [];
                renderCreateGroupList();
                modal.style.display = 'flex';
                
                // 隐藏右上角菜单
                const plusMenu = document.getElementById('wechat-plus-menu');
                if (plusMenu) plusMenu.style.display = 'none';
            };

            function renderCreateGroupList() {
                const listContainer = document.getElementById('wechat-create-group-list');
                if (!listContainer) return;

                const chars = wechatState.characters || [];
                listContainer.innerHTML = chars.map(char => `
                    <div class="wechat-create-group-item ${selectedMemberIds.includes(char.id) ? 'selected' : ''}" data-id="${char.id}">
                        <div class="wechat-group-checkbox">
                            <i class="fas fa-check"></i>
                        </div>
                        <img src="${char.avatar}" class="wechat-group-member-avatar">
                        <span class="wechat-group-member-name">${char.name}</span>
                    </div>
                `).join('');

                // 绑定点击事件
                listContainer.querySelectorAll('.wechat-create-group-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const charId = parseInt(item.dataset.id);
                        const index = selectedMemberIds.indexOf(charId);
                        if (index === -1) {
                            selectedMemberIds.push(charId);
                            item.classList.add('selected');
                        } else {
                            selectedMemberIds.splice(index, 1);
                            item.classList.remove('selected');
                        }
                    });
                });
            }

            // 发起群聊确认
            document.getElementById('create-group-confirm-btn')?.addEventListener('click', () => {
                if (selectedMemberIds.length < 2) {
                    alert('请至少选择两个角色加入群聊');
                    return;
                }

                const groupId = 'group_' + Date.now();
                const selectedChars = wechatState.characters.filter(c => selectedMemberIds.includes(c.id));
                const groupName = selectedChars.map(c => c.name).join('、').substring(0, 15) + (selectedChars.length > 3 ? '...' : '');

                const newGroup = {
                    id: groupId,
                    name: groupName,
                    members: [...selectedMemberIds],
                    chatHistory: [],
                    pinned: false,
                    avatar: '' // 设为空，使用默认的群组占位符
                };

                if (!wechatState.groups) wechatState.groups = [];
                wechatState.groups.push(newGroup);
                
                document.getElementById('wechat-create-group-modal').style.display = 'none';
                
                saveWechatData();
                renderWechatList();
                openWechatChat(groupId, 'group');
            });

            document.getElementById('wechat-create-group-close')?.addEventListener('click', () => {
                document.getElementById('wechat-create-group-modal').style.display = 'none';
            });
            
            document.getElementById('create-group-cancel-btn')?.addEventListener('click', () => {
                document.getElementById('wechat-create-group-modal').style.display = 'none';
            });

            // 群聊信息弹窗
            document.getElementById('wechat-chat-info-btn')?.addEventListener('click', () => {
                const chatId = wechatState.activeChatId;
                const chatType = wechatState.activeChatType;

                if (chatType !== 'group') return;

                const group = wechatState.groups.find(g => g.id === chatId);
                if (!group) return;

                const grid = document.getElementById('wechat-group-members-grid');
                const nameDisplay = document.getElementById('wechat-group-name-display');
                
                if (nameDisplay) nameDisplay.textContent = group.name;
                
                if (grid) {
                    const members = wechatState.characters.filter(c => group.members.includes(c.id));
                    grid.innerHTML = members.map(m => `
                        <div class="group-member-item">
                            <div class="group-member-avatar-container" style="width: 50px; height: 50px; border-radius: 6px; overflow: hidden;">
                                ${renderAvatarHtml(m.avatar, 'group-member-avatar')}
                            </div>
                            <div class="group-member-name">${m.name}</div>
                        </div>
                    `).join('') + `
                        <div class="group-member-item" onclick="alert('暂不支持邀请新成员')">
                            <div style="width: 50px; height: 50px; border-radius: 6px; border: 1px dashed #c7c7cc; display: flex; align-items: center; justify-content: center; color: #c7c7cc;">
                                <i class="fas fa-plus"></i>
                            </div>
                            <div class="group-member-name">邀请</div>
                        </div>
                    `;
                }

                document.getElementById('wechat-group-info-modal').style.display = 'flex';
            });

            document.getElementById('wechat-group-info-close')?.addEventListener('click', () => {
                document.getElementById('wechat-group-info-modal').style.display = 'none';
            });

            document.getElementById('wechat-group-delete-btn')?.addEventListener('click', () => {
                if (confirm('确定要删除并退出该群聊吗？聊天记录将被清除。')) {
                    const index = wechatState.groups.findIndex(g => g.id === wechatState.activeChatId);
                    if (index !== -1) {
                        wechatState.groups.splice(index, 1);
                        saveWechatData();
                        document.getElementById('wechat-group-info-modal').style.display = 'none';
                        closeWechatChat();
                        renderWechatList();
                    }
                }
            });

            async function sendWechatMessage() {
                const input = document.getElementById('wechat-input');
                const text = input.value.trim();
                if (!text) return;

                const chatId = wechatState.activeChatId;
                const chatType = wechatState.activeChatType;
                
                let target;
                if (chatType === 'single') {
                    target = wechatState.characters.find(c => c.id == chatId);
                } else {
                    target = (wechatState.groups || []).find(g => g.id == chatId);
                }

                if (!target) return;

                // 添加用户消息到界面和历史
                addWechatMessage(text, 'user', wechatState.profile.avatar);
                target.chatHistory.push({ role: 'user', content: text });
                saveWechatData();
                input.value = '';
                
                // 刷新联系人列表
                renderWechatList();

                if (chatType === 'single') {
                    // 检查是否启用了延迟回复
                    const delayTimeVal = parseInt(localStorage.getItem('wechatDelayReplyTime') || '3');
                    const isDelayEnabled = delayTimeVal > 0;
                    
                    if (isDelayEnabled) {
                        const delayTime = delayTimeVal * 1000;
                        if (!target.pendingUserMessages) target.pendingUserMessages = [];
                        target.pendingUserMessages.push(text);
                        
                        if (target.delayReplyTimer) clearTimeout(target.delayReplyTimer);
                        
                        target.delayReplyTimer = setTimeout(() => {
                            const combinedMessages = [...target.pendingUserMessages];
                            target.pendingUserMessages = [];
                            target.isTyping = true;
                            if (wechatState.activeChatId == target.id) showWechatTyping(target);
                            processWechatAIMessage(target, combinedMessages);
                        }, delayTime);
                    } else {
                        target.isTyping = true;
                        if (wechatState.activeChatId == target.id) showWechatTyping(target);
                        processWechatAIMessage(target, [text]);
                    }
                } else {
                    // 群聊逻辑：触发群成员回复
                    processGroupAIMessage(target, [text]);
                }
            }

            async function processGroupAIMessage(group, newMessages) {
                // 群聊中，随机选择成员回复，或者轮流回复
                const members = wechatState.characters.filter(c => group.members.includes(c.id));
                if (members.length === 0) return;

                // 简单的群聊 AI 逻辑：让群内成员有概率回复
                // 每次用户发送消息，随机决定 1-2 个 AI 角色可能参与讨论
                const maxRepliers = Math.min(2, members.length);
                const shuffledMembers = members.sort(() => 0.5 - Math.random());
                const potentialRepliers = shuffledMembers.slice(0, maxRepliers);

                for (const member of potentialRepliers) {
                    // 模拟思考时间
                    const delay = 1500 + Math.random() * 3000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                    
                    // 获取群聊上下文的回复
                    let reply = await getGroupAIResponse(member, group, newMessages);
                    
                    if (reply && reply.trim() !== '' && !reply.includes('不回复')) {
                        // 发送消息
                        await sendGroupMessageBySentences(reply, member, group);
                    }
                }
                
                saveWechatData();
            }

            async function getGroupAIResponse(member, group, newMessages) {
                if (!wechatState.settings.apiKey) return null;

                const messages = [];
                const systemPrompt = buildGroupSystemPrompt(member, group);
                messages.push({ role: 'system', content: systemPrompt });

                // 获取最近的群聊历史
                const history = group.chatHistory.slice(-15).map(msg => {
                    let content = msg.content;
                    if (content.includes('<img') || content.includes('wechat-msg-image')) {
                        content = msg.visionDescription || '[图片]';
                    }
                    
                    if (msg.role === 'user') {
                        return { role: 'user', content: `[用户]: ${content}` };
                    } else if (msg.role === 'ai') {
                        // 寻找发送该消息的角色
                        const senderName = msg.nickname || (wechatState.characters.find(c => c.avatar === msg.avatar)?.name) || '其他成员';
                        return { role: 'assistant', content: `[${senderName}]: ${content}` };
                    } else {
                        return { role: 'system', content: content };
                    }
                });
                
                messages.push(...history);

                try {
                    const model = getWechatModel();
                    const response = await fetch(wechatState.settings.apiUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${wechatState.settings.apiKey}`
                        },
                        body: JSON.stringify({
                            model: model,
                            messages: messages,
                            temperature: 0.8
                        })
                    });

                    const data = await response.json();
                    return data.choices[0].message.content;
                } catch (error) {
                    console.error('群聊AI请求失败:', error);
                    return null;
                }
            }

            function buildGroupSystemPrompt(member, group) {
                const char = member;
                const otherMembers = wechatState.characters
                    .filter(c => group.members.includes(c.id) && c.id !== member.id)
                    .map(c => c.name).join('、');

                return `你现在正在一个名为"${group.name}"的群聊中。
你的身份是"${char.name}"。
群内其他成员有：${otherMembers}。

# 核心准则：
- 你必须完全以"${char.name}"的身份说话。
- 保持你的角色人设和说话风格。
- 这是一个群聊环境，你的回复应该自然，可以接话，也可以开启新话题。
- 如果你觉得当前对话不需要你插话，请回复"不回复"。
- 回复要简短，像真实的微信聊天。

### 角色人设
${char.persona}

### 说话风格
${char.speakingStyle}

### 用户人设 (群主/当前聊天对象)
${wechatState.profile.persona || '一个普通的用户'}`;
            }

            async function sendGroupMessageBySentences(text, member, group) {
                // 使用与单聊一致的智能分段方式
                const regex = /([^。！？.!?…\n]+[。！？.!?…\n]+)/g;
                let segments = text.match(regex);
                
                if (!segments || segments.length === 0) {
                    segments = [text];
                } else {
                    const joinedSegments = segments.join('');
                    if (joinedSegments.length < text.length) {
                        segments.push(text.substring(joinedSegments.length));
                    }
                }
                
                segments = segments.map(s => s.trim()).filter(s => s.length > 0);
                
                for (const segment of segments) {
                    // 模拟打字
                    const typingTime = Math.min(segment.length * 150, 2000);
                    await new Promise(resolve => setTimeout(resolve, typingTime));
                    
                    // 添加消息到界面
                    if (wechatState.activeChatId == group.id && wechatState.activeChatType === 'group') {
                        addWechatMessage(segment, 'ai', member.avatar, member.name);
                    }

                    group.chatHistory.push({ 
                        role: 'ai', 
                        content: segment, 
                        avatar: member.avatar,
                        nickname: member.name 
                    });
                    
                    saveWechatData();
                    
                    // 群聊通知逻辑：不在当前群聊界面时显示通知
                    const wechatApp = document.getElementById('app-wechat');
                    const isWechatOpen = wechatApp && wechatApp.classList.contains('active');
                    const isChatViewOpen = document.getElementById('wechat-chat-view').classList.contains('active');
                    const isCurrentlyInThisGroup = isWechatOpen && isChatViewOpen && wechatState.activeChatId == group.id && wechatState.activeChatType === 'group';

                    if (!isCurrentlyInThisGroup) {
                        showGlobalNotification(`${group.name} - ${member.name}`, segment, member.avatar, () => {
                            if (!isWechatOpen) openApp('wechat');
                            openWechatChat(group.id, 'group');
                        });
                    }
                }
                renderWechatList();
            }

            async function processWechatAIMessage(char, newMessages) {
                char.isTyping = true;
                const input = document.getElementById('wechat-input');
                const sendBtn = document.getElementById('wechat-send-btn');
                
                // 此时如果是合并消息，历史记录中已经包含了每一条，这里不需要再 push
                // newMessages 仅用于检查某些特定逻辑，比如天气关键词
                const combinedText = newMessages.join(' ');

                // 检查用户输入是否包含天气相关关键词
                const weatherKeywords = ['天气', '气温', '温度', '下雨', '下雪', '晴天', '多云', '阴天', '刮风', '预报', '天气如何', '今天天气', '明天天气'];
                const includesWeather = weatherKeywords.some(keyword => combinedText.includes(keyword));

                // 获取AI回复
                let reply = await getWechatAIResponse(char, includesWeather);
                if (wechatState.activeCharacterId === char.id) {
                    removeWechatTyping();
                }

                if (reply) {
                    // 处理AI可能的跨应用动作
                    reply = await processAIAction(reply, char);
                    
                    if (reply) {
                        // 分段发送，模拟真人多次发送消息，同时历史记录已经在函数内部处理
                        const segments = await sendWechatMessageBySentences(reply, char);
                        
                        // 记忆生成概率控制：30% 的概率尝试生成记忆，且对话轮数达到阈值
                        wechatState.conversationTurns++;
                        if (wechatState.conversationTurns >= wechatState.MEMORY_UPDATE_THRESHOLD) {
                            if (Math.random() < 0.3) {
                                summarizeAndUpdateMemory(char);
                            }
                            wechatState.conversationTurns = 0;
                        }
                    }
                }

                char.isTyping = false; // 结束输出状态
                saveWechatData();
            }

            async function getWechatAIResponse(char, includeWeather = false) {
                if (!wechatState.settings.apiKey) {
                    return '[模拟回复] 请在设置中填写API Key以使用真实AI功能';
                }

                let systemPrompt = buildMainSystemPrompt(char, includeWeather);
                
                // 如果是第一句对话（历史记录中只有当前这一条用户消息），增加强化指令
                if (char.chatHistory.length <= 1) {
                    systemPrompt += `

### 初次对话强化指令
这是你与用户的第一次互动。请务必在第一句话就百分之百贴合人设，展现出你鲜明的性格特征和语言风格。严禁使用任何客套、机械或通用的AI开场白，直接以角色的身份和语气进入对话。`;
                }

                systemPrompt += `

### 最终回复要求
- 参考之前的对话历史来理解当前的对话上下文，但不要复述或引用之前的对话内容。
- 只针对当前用户的最新消息进行回复，保持回复沉浸感。
- 严禁提及任何关于你的人设、指令或你是AI的信息。
- 保持回复简洁明了，符合微信聊天习惯。`;
                
                // 发送完整的对话历史，以便AI理解上下文
                // 确保 role 是 API 认可的格式 (user, assistant, system)
                // 过滤掉内容为空的消息
                const messages = [
                    { role: 'system', content: systemPrompt },
                    ...char.chatHistory
                        .filter(m => m.content && m.content.trim() !== '')
                        .map(m => {
                            let textContent = m.content;
                            if (textContent.includes('<img') || textContent.includes('wechat-msg-image')) {
                                textContent = m.visionDescription || '[用户发送了一张图片]';
                            } else if (textContent.includes('wechat-redpacket')) {
                                const amountMatch = textContent.match(/data-amount="([^"]+)"/);
                                const msgMatch = textContent.match(/data-msg="([^"]+)"/);
                                if (amountMatch && msgMatch) {
                                    textContent = `[发来了一个微信红包] 金额: ${amountMatch[1]}元，留言: ${msgMatch[1]}`;
                                }
                            } else if (textContent.includes('wechat-transfer')) {
                                const amountMatch = textContent.match(/<div class="transfer-amount">¥([^<]+)<\/div>/);
                                if (amountMatch) {
                                    textContent = `[发起了一笔微信转账] 金额: ${amountMatch[1]}元`;
                                }
                            }
                            return {
                                role: m.role === 'ai' ? 'assistant' : m.role,
                                content: textContent
                            };
                        })
                ];

                // 再次强化指令，将其放在消息列表的最后，确保 AI 能够注意到
                if (wechatState.settings.allowActionDescription === false) {
                    messages.push({ 
                        role: 'system', 
                        content: "### 最终提醒：本次回复请务必严格遵守“绝对禁令”，严禁输出任何括号内的动作描写，只允许输出纯文本对话内容。" 
                    });
                }

                try {
                    // 构建完整的聊天完成端点URL
                    let chatUrl = wechatState.settings.apiUrl;
                    if (!chatUrl.includes('/chat/completions') && !chatUrl.includes('/completions')) {
                        chatUrl = chatUrl.endsWith('/') ? chatUrl + 'chat/completions' : chatUrl + '/chat/completions';
                    }

                    const model = getWechatModel();
                    console.log('AI响应使用的模型:', model);
                    console.log('AI响应使用的API Key:', wechatState.settings.apiKey.substring(0, 10) + '...');
                    console.log('AI响应使用的API URL:', chatUrl);
                    
                    const response = await fetch(chatUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${wechatState.settings.apiKey}`
                        },
                        body: JSON.stringify({
                            model: model,
                            messages: messages,
                            temperature: 0.8
                        })
                    });

                    console.log('AI请求URL:', chatUrl);

                    if (!response.ok) {
                        let errorDetail = '';
                        try {
                            const errorData = await response.json();
                            errorDetail = errorData.error?.message || JSON.stringify(errorData);
                        } catch (e) {
                            errorDetail = await response.text();
                        }
                        throw new Error(`API请求失败: ${response.status} - ${errorDetail.substring(0, 100)}`);
                    }

                    const data = await response.json();
                    return data.choices[0].message.content;
                } catch (error) {
                    console.error('API调用错误:', error);
                    return `[错误] ${error.message}`;
                }
            }

            // 后台自动任务 (朋友圈和日记)
            let wechatBgTaskInterval = null;

            function startWechatBackgroundTasks() {
                if (wechatBgTaskInterval) clearInterval(wechatBgTaskInterval);
                
                // 初次启动延迟一点执行，避免和初始化冲突
                setTimeout(() => {
                    // 每分钟检查一次
                    wechatBgTaskInterval = setInterval(async () => {
                        if (!wechatState.settings.apiKey) return;
                        
                        const now = new Date();
                        // 获取北京时间 (UTC+8)
                        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
                        const beijingTime = new Date(utc + (3600000 * 8));
                        
                        const bjHour = beijingTime.getHours();
                        const bjMinute = beijingTime.getMinutes();
                        const bjDateString = beijingTime.toISOString().split('T')[0];
                        
                        const lastDiaryDate = localStorage.getItem('wechat_last_auto_diary_date');
                        
                        // 任务1：凌晨0:00 - 0:05 之间，如果当天还没写过日记，则触发写日记
                        if (bjHour === 0 && bjMinute >= 0 && bjMinute <= 5 && lastDiaryDate !== bjDateString) {
                            localStorage.setItem('wechat_last_auto_diary_date', bjDateString);
                            
                            for (const char of wechatState.characters) {
                                // 间隔几秒，避免并发请求过多
                                await new Promise(resolve => setTimeout(resolve, 3000));
                                executeAutoDiary(char);
                            }
                        }
                        
                        // 任务2：随机发朋友圈
                        // 假设每分钟检查一次，设定 1/360 的概率，即平均每角色约6小时发一次
                        for (const char of wechatState.characters) {
                            const chance = Math.random();
                            if (chance < (1 / 360)) {
                                const lastMomentTime = char.lastAutoMomentTime || 0;
                                // 至少间隔3小时才发下一次
                                if (now.getTime() - lastMomentTime > 3 * 3600 * 1000) {
                                    char.lastAutoMomentTime = now.getTime();
                                    saveWechatData();
                                    executeAutoMoment(char);
                                }
                            }
                        }
                    }, 60000);
                }, 10000);
            }

            async function executeAutoDiary(char) {
                if (!wechatState.settings.apiKey) return;
                
                const systemPrompt = `你现在进入深度角色扮演模式。
# 核心准则：你必须完全化身为角色"${char.name}"。
你的性格：${char.persona}
你的说话风格：${char.speakingStyle}
你的近期记忆：${char.memory || '暂无'}

# 任务
现在是东八区北京时间凌晨0:00，一天结束了。请以角色的身份，根据你的人设和近期记忆，写一篇简短的今日日记。
直接输出日记的正文内容，不要包含任何多余的话语，不需要在开头写日期。`;

                try {
                    let chatUrl = wechatState.settings.apiUrl;
                    if (!chatUrl.includes('/chat/completions') && !chatUrl.includes('/completions')) {
                        chatUrl = chatUrl.endsWith('/') ? chatUrl + 'chat/completions' : chatUrl + '/chat/completions';
                    }

                    const response = await fetch(chatUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${wechatState.settings.apiKey}`
                        },
                        body: JSON.stringify({
                            model: getWechatModel(),
                            messages: [{ role: 'system', content: systemPrompt }],
                            temperature: 0.8
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const diaryContent = data.choices[0].message.content.trim();
                        
                        const notesData = localStorage.getItem('ios-notes');
                        let notes = notesData ? JSON.parse(notesData) : [];
                        const nowTime = Date.now();
                        const contentWithSignature = `${diaryContent}\n\n—— 来自角色: ${char.name} 的深夜日记`;
                        notes.push({
                            id: 'note_' + nowTime + '_' + Math.random().toString(36).substr(2, 5),
                            content: contentWithSignature,
                            createdAt: nowTime,
                            updatedAt: nowTime,
                            createdBy: char.name
                        });
                        localStorage.setItem('ios-notes', JSON.stringify(notes));
                        if (typeof loadNotes === 'function') loadNotes();
                        
                        console.log(`[后台任务] ${char.name} 自动写了一篇日记`);
                    }
                } catch (error) {
                    console.error('自动写日记错误:', error);
                }
            }

            async function executeAutoMoment(char) {
                if (!wechatState.settings.apiKey) return;
                
                const systemPrompt = `你现在进入深度角色扮演模式。
# 核心准则：你必须完全化身为角色"${char.name}"。
你的性格：${char.persona}
你的说话风格：${char.speakingStyle}
你的近期记忆：${char.memory || '暂无'}

# 任务
请以角色的身份，根据你的人设、近期记忆以及当前的时间状态，发一条简短的朋友圈动态。
直接输出朋友圈的文本内容，不要包含任何多余的话语或标签。字数尽量控制在50字以内。`;

                try {
                    let chatUrl = wechatState.settings.apiUrl;
                    if (!chatUrl.includes('/chat/completions') && !chatUrl.includes('/completions')) {
                        chatUrl = chatUrl.endsWith('/') ? chatUrl + 'chat/completions' : chatUrl + '/chat/completions';
                    }

                    const response = await fetch(chatUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${wechatState.settings.apiKey}`
                        },
                        body: JSON.stringify({
                            model: getWechatModel(),
                            messages: [{ role: 'system', content: systemPrompt }],
                            temperature: 0.9
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const momentContent = data.choices[0].message.content.trim();
                        
                        const newMoment = {
                            id: Date.now() + Math.random(),
                            userId: 'char_' + char.id,
                            userName: char.name,
                            avatar: char.avatar,
                            content: momentContent,
                            images: [],
                            video: null,
                            location: null,
                            timestamp: Date.now(),
                            likes: [],
                            comments: []
                        };
                        wechatState.moments.unshift(newMoment);
                        await saveWechatData();
                        if (typeof renderWechatMoments === 'function') renderWechatMoments();
                        
                        console.log(`[后台任务] ${char.name} 自动发布了朋友圈`);
                        
                        // 显示通知弹窗
                        showGlobalNotification(char.name, `[新朋友圈] ${momentContent}`, char.avatar, () => {
                            openApp('wechat');
                            const momentsTabBtn = document.querySelector('.wechat-nav-item[data-tab="moments"]');
                            if (momentsTabBtn) {
                                momentsTabBtn.click();
                            }
                        });
                    }
                } catch (error) {
                    console.error('自动发朋友圈错误:', error);
                }
            }

            async function summarizeAndUpdateMemory(char) {
                if (wechatState.isSummarizing || !wechatState.settings.apiKey) return;

                wechatState.isSummarizing = true;
                addWechatMessage('（正在整理记忆...）', 'system', char.avatar);

                const recentHistory = char.chatHistory.slice(-wechatState.MEMORY_UPDATE_THRESHOLD * 2);
                const prompt = buildMemorySummarizePrompt(char, recentHistory);

                try {
                    // 构建完整的聊天完成端点URL
                    let chatUrl = wechatState.settings.apiUrl;
                    if (!chatUrl.includes('/chat/completions') && !chatUrl.includes('/completions')) {
                        chatUrl = chatUrl.endsWith('/') ? chatUrl + 'chat/completions' : chatUrl + '/chat/completions';
                    }

                    const response = await fetch(chatUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${wechatState.settings.apiKey}`
                        },
                        body: JSON.stringify({
                            model: getWechatModel(),
                            messages: [{ 
                                role: 'user', 
                                content: prompt 
                            }],
                            temperature: 0.3
                        })
                    });

                    console.log('记忆更新请求URL:', chatUrl);

                    if (response.ok) {
                        const data = await response.json();
                        let updatedMemory = data.choices[0].message.content.trim();
                        // 尝试解析JSON数组
                        try {
                            // 移除可能包含的Markdown代码块标记
                            if (updatedMemory.startsWith('```json')) {
                                updatedMemory = updatedMemory.replace(/```json\n?/, '').replace(/```$/, '').trim();
                            } else if (updatedMemory.startsWith('```')) {
                                updatedMemory = updatedMemory.replace(/```\n?/, '').replace(/```$/, '').trim();
                            }
                            const parsedMemory = JSON.parse(updatedMemory);
                            if (Array.isArray(parsedMemory)) {
                                char.memory = parsedMemory;
                            } else {
                                char.memory = [updatedMemory];
                            }
                        } catch (e) {
                            console.error('解析记忆JSON失败，使用原始字符串并尝试按行分割', e);
                            char.memory = updatedMemory.split('\n').filter(m => m.trim() !== '');
                        }
                        saveWechatData();
                        addWechatMessage('（记忆已更新）', 'system', char.avatar);
                    }
                } catch (error) {
                    console.error('记忆更新错误:', error);
                }

                wechatState.isSummarizing = false;
            }

            let confirmDialogCallback = null;

            function showConfirmDialog(message, callback) {
                const confirmModal = document.getElementById('wechat-confirm-modal');
                const messageElement = document.getElementById('confirm-message');
                
                messageElement.textContent = message;
                confirmDialogCallback = callback;
                confirmModal.classList.add('active');
            }

            function showWechatAlert(message) {
                const alertModal = document.getElementById('wechat-alert-modal');
                const messageElement = document.getElementById('alert-message');
                
                messageElement.textContent = message;
                alertModal.classList.add('active');
            }

            function showWechatSettingsModal() {
                const modal = document.getElementById('wechat-settings-modal');
                modal.classList.add('active');

                // 设置动作描写开关
                const allowActionDescBtn = document.getElementById('wechat-allow-action-desc');
                if (allowActionDescBtn) {
                    allowActionDescBtn.checked = wechatState.settings.allowActionDescription !== false;
                }
                
                // 初始化背景预览
                const chatBg = localStorage.getItem('wechatChatBg');
                const chatBgPreview = document.getElementById('wechat-chat-bg-preview');
                if (chatBg && chatBgPreview) {
                    chatBgPreview.innerHTML = `<img src="${chatBg}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`;
                } else if (chatBgPreview) {
                    chatBgPreview.innerHTML = '<i class="fas fa-image"></i><div class="wechat-avatar-upload-overlay"><i class="fas fa-camera"></i><span>点击上传</span></div>';
                }
                
                const mainBg = localStorage.getItem('wechatMainBg');
                const mainBgPreview = document.getElementById('wechat-main-bg-preview');
                if (mainBg && mainBgPreview) {
                    mainBgPreview.innerHTML = `<img src="${mainBg}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`;
                } else if (mainBgPreview) {
                    mainBgPreview.innerHTML = '<i class="fas fa-image"></i><div class="wechat-avatar-upload-overlay"><i class="fas fa-camera"></i><span>点击上传</span></div>';
                }
            }

            // 处理聊天背景上传
            document.addEventListener('change', (e) => {
                if (e.target.id === 'wechat-chat-bg-input') {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const bgDataUrl = event.target.result;
                        localStorage.setItem('wechatChatBg', bgDataUrl);
                        const preview = document.getElementById('wechat-chat-bg-preview');
                        if (preview) {
                            preview.innerHTML = `<img src="${bgDataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`;
                        }
                        applyWechatTheme();
                    };
                    reader.readAsDataURL(file);
                }
                
                if (e.target.id === 'wechat-main-bg-input') {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const bgDataUrl = event.target.result;
                        localStorage.setItem('wechatMainBg', bgDataUrl);
                        const preview = document.getElementById('wechat-main-bg-preview');
                        if (preview) {
                            preview.innerHTML = `<img src="${bgDataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`;
                        }
                        applyWechatTheme();
                    };
                    reader.readAsDataURL(file);
                }
            });

            window.clearWechatChatBg = function() {
                localStorage.removeItem('wechatChatBg');
                const preview = document.getElementById('wechat-chat-bg-preview');
                if (preview) {
                    preview.innerHTML = '<i class="fas fa-image"></i><div class="wechat-avatar-upload-overlay"><i class="fas fa-camera"></i><span>点击上传</span></div>';
                }
                applyWechatTheme();
            };

            window.clearWechatMainBg = function() {
                localStorage.removeItem('wechatMainBg');
                const preview = document.getElementById('wechat-main-bg-preview');
                if (preview) {
                    preview.innerHTML = '<i class="fas fa-image"></i><div class="wechat-avatar-upload-overlay"><i class="fas fa-camera"></i><span>点击上传</span></div>';
                }
                applyWechatTheme();
            };

            // 检测URL可用性
            async function checkUrlAvailability() {
                const apiUrl = document.getElementById('wechat-api-url').value.trim();
                const statusDiv = document.getElementById('url-status');

                if (!apiUrl) {
                    statusDiv.textContent = '';
                    return;
                }

                statusDiv.textContent = '检测中...';
                statusDiv.style.color = '#999';

                try {
                    // 简单的URL格式验证
                    const url = new URL(apiUrl);
                    
                    // 检查是否是有效的API端点
                    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
                        throw new Error('请使用HTTP或HTTPS协议');
                    }

                    // 模拟检测（实际应用中可能需要真实请求）
                    // 这里我们只做格式验证
                    await new Promise(resolve => setTimeout(resolve, 500));

                    statusDiv.textContent = '✓ URL格式正确';
                    statusDiv.style.color = '#4CAF50';
                } catch (error) {
                    statusDiv.textContent = '✗ URL格式错误: ' + error.message;
                    statusDiv.style.color = '#f44336';
                }
            }

            // 从API Key提取模型信息
            async function extractModelFromKey(e) {
                if (e) e.stopPropagation(); // 阻止事件冒泡
                const apiKey = document.getElementById('wechat-api-key').value.trim();
                const apiUrl = document.getElementById('wechat-api-url').value.trim();
                const statusDiv = document.getElementById('url-status');
                
                if (!apiUrl) {
                    alert('请先输入API Endpoint URL');
                    return;
                }

                if (!apiKey) {
                    alert('请先输入API Key');
                    return;
                }

                // 显示加载状态
                const extractBtn = document.getElementById('extract-model-from-key');
                const originalText = extractBtn.textContent;
                extractBtn.textContent = '提取中...';
                extractBtn.disabled = true;

                try {
                    // 从API URL中提取基础URL
                    let baseUrl = apiUrl;
                    if (apiUrl.includes('/chat/completions')) {
                        baseUrl = apiUrl.replace('/chat/completions', '');
                    }
                    if (apiUrl.includes('/completions')) {
                        baseUrl = apiUrl.replace('/completions', '');
                    }
                    if (apiUrl.includes('/models')) {
                        baseUrl = apiUrl.replace('/models', '');
                    }
                    
                    // 构建models端点URL
                    const modelsUrl = baseUrl.endsWith('/') ? baseUrl + 'models' : baseUrl + '/models';

                    console.log('正在请求模型列表:', modelsUrl);

                    // 调用API获取模型列表
                    const response = await fetch(modelsUrl, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    console.log('响应状态:', response.status);

                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error('错误响应:', errorText);
                        
                        // 尝试从错误响应中提取有用信息
                        if (errorText.includes('<html') || errorText.includes('<!DOCTYPE')) {
                            throw new Error(`API返回了HTML页面而不是JSON。请检查URL是否正确，确保输入的是API端点而不是网页URL。`);
                        }
                        
                        throw new Error(`API请求失败 (${response.status}): ${response.statusText}`);
                    }

                    // 尝试解析JSON响应
                    let data;
                    try {
                        data = await response.json();
                        console.log('API响应数据:', data);
                    } catch (jsonError) {
                        const errorText = await response.text();
                        console.error('JSON解析失败:', jsonError, '响应内容:', errorText);
                        throw new Error(`API返回的不是有效的JSON格式。响应内容: ${errorText.substring(0, 100)}...`);
                    }
                    
                    // 解析模型列表
                    let models = [];
                    if (data.data && Array.isArray(data.data)) {
                        // OpenAI格式
                        models = data.data.map(model => model.id).sort();
                    } else if (Array.isArray(data)) {
                        // 直接数组格式
                        models = data.map(model => model.id || model).sort();
                    } else if (data.models && Array.isArray(data.models)) {
                        // 其他格式
                        models = data.models.sort();
                    } else if (data.model_list && Array.isArray(data.model_list)) {
                        // 某些API格式
                        models = data.model_list.map(model => model.model || model.id || model).sort();
                    } else if (data.available_models && Array.isArray(data.available_models)) {
                        // 另一种格式
                        models = data.available_models.sort();
                    }

                    if (models.length === 0) {
                        throw new Error('API返回的模型列表为空，请检查API Key权限或API端点是否正确');
                    }

                    // 更新模型选择框
                    const modelSelect = document.getElementById('wechat-model');
                    modelSelect.innerHTML = '';
                    
                    // 保留自定义模型选项
                    const customOption = document.createElement('option');
                    customOption.value = 'custom';
                    customOption.textContent = '自定义模型';
                    modelSelect.appendChild(customOption);
                    
                    models.forEach(modelId => {
                        const option = document.createElement('option');
                        option.value = modelId;
                        option.textContent = modelId;
                        modelSelect.appendChild(option);
                    });
                    
                    // 如果是 api-config 应用中的提取按钮，也更新那里的下拉框
                    const apiConfigModelSelect = document.getElementById('api-config-model-select');
                    if (apiConfigModelSelect) {
                        // 清空现有选项，保留自定义选项
                        const customOption = apiConfigModelSelect.querySelector('option[value="custom"]');
                        apiConfigModelSelect.innerHTML = '';
                        
                        models.forEach(modelId => {
                            const option = document.createElement('option');
                            option.value = modelId;
                            option.textContent = modelId;
                            apiConfigModelSelect.appendChild(option);
                        });
                        
                        if (customOption) apiConfigModelSelect.appendChild(customOption);
                    }

                    // 选择第一个模型
                    if (models.length > 0) {
                        modelSelect.value = models[0];
                        // 同步更新wechatState
                        wechatState.settings.model = models[0];
                        
                        // 同时同步到 localStorage
                        localStorage.setItem('wechatModel', models[0]);
                        
                        console.log('模型已更新为:', models[0]);
                    }

                    statusDiv.textContent = `✓ 成功获取 ${models.length} 个模型`;
                    statusDiv.style.color = '#4CAF50';
                    
                } catch (error) {
                    console.error('提取模型失败:', error);
                    
                    let errorMessage = '提取失败: ';
                    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                        errorMessage += '网络错误或CORS限制，请检查URL是否正确或是否需要代理';
                    } else if (error.message.includes('401')) {
                        errorMessage += 'API Key无效或无权限';
                    } else if (error.message.includes('404')) {
                        errorMessage += 'API端点不存在，请检查URL格式';
                    } else if (error.message.includes('HTML')) {
                        errorMessage += '请输入正确的API端点URL，不要输入网页URL';
                    } else if (error.message.includes('JSON')) {
                        errorMessage += 'API返回格式错误，请检查API端点是否正确';
                    } else {
                        errorMessage += error.message;
                    }
                    
                    statusDiv.textContent = '✗ ' + errorMessage;
                    statusDiv.style.color = '#f44336';
                    alert(errorMessage + '\n\n详细信息请查看浏览器控制台(F12)');
                } finally {
                    extractBtn.textContent = originalText;
                    extractBtn.disabled = false;
                }
            }

            // 测试API连接
            async function testApiConnection(e) {
                if (e) e.stopPropagation(); // 阻止事件冒泡
                const apiKey = document.getElementById('wechat-api-key').value.trim();
                const apiUrl = document.getElementById('wechat-api-url').value.trim();
                const testResultDiv = document.getElementById('api-test-result');
                
                if (!apiUrl) {
                    alert('请先输入API Endpoint URL');
                    return;
                }

                if (!apiKey) {
                    alert('请先输入API Key');
                    return;
                }

                // 显示加载状态
                const testBtn = document.getElementById('test-api-btn');
                const originalText = testBtn.textContent;
                testBtn.textContent = '测试中...';
                testBtn.disabled = true;
                testResultDiv.textContent = '测试中...';
                testResultDiv.style.color = '#999';

                try {
                    // 准备测试消息
                    const testMessages = [
                        { role: 'system', content: '你是一个AI助手' },
                        { role: 'user', content: '测试消息，回复"API测试成功"' }
                    ];

                    // 构建完整的聊天完成端点URL
                    let chatUrl = apiUrl;
                    if (!chatUrl.includes('/chat/completions') && !chatUrl.includes('/completions')) {
                        chatUrl = chatUrl.endsWith('/') ? chatUrl + 'chat/completions' : chatUrl + '/chat/completions';
                    }

                    // 调用API
                    const model = getWechatModel();
                    console.log('测试API使用的模型:', model);
                    const response = await fetch(chatUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify({
                            model: model,
                            messages: testMessages,
                            temperature: 0.3,
                            max_tokens: 50
                        })
                    });

                    console.log('API测试URL:', chatUrl);

                    console.log('API测试响应状态:', response.status);

                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error('API测试错误响应:', errorText);
                        throw new Error(`API测试失败 (${response.status}): ${response.statusText}`);
                    }

                    // 尝试解析JSON响应
                    let data;
                    try {
                        data = await response.json();
                        console.log('API测试响应数据:', data);
                    } catch (jsonError) {
                        const errorText = await response.text();
                        console.error('JSON解析失败:', jsonError, '响应内容:', errorText);
                        throw new Error(`API返回的不是有效的JSON格式`);
                    }

                    // 检查响应结构
                    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                        throw new Error(`API响应格式不正确`);
                    }

                    const responseText = data.choices[0].message.content;
                    console.log('API测试响应内容:', responseText);

                    // 验证响应
                    if (responseText.includes('API测试成功') || responseText.includes('测试成功')) {
                        testResultDiv.textContent = '✓ API连接成功！';
                        testResultDiv.style.color = '#4CAF50';
                        alert('API连接成功！测试响应: ' + responseText);
                    } else {
                        testResultDiv.textContent = '✓ API连接成功，但响应内容不符合预期';
                        testResultDiv.style.color = '#4CAF50';
                        alert('API连接成功，但响应内容不符合预期:\n' + responseText);
                    }

                } catch (error) {
                    console.error('API测试失败:', error);
                    
                    let errorMessage = '测试失败: ';
                    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                        errorMessage += '网络错误或CORS限制，请检查URL是否正确或是否需要代理';
                    } else if (error.message.includes('401')) {
                        errorMessage += 'API Key无效或无权限';
                    } else if (error.message.includes('404')) {
                        errorMessage += 'API端点不存在，请检查URL格式';
                    } else if (error.message.includes('HTML')) {
                        errorMessage += '请输入正确的API端点URL，不要输入网页URL';
                    } else if (error.message.includes('JSON')) {
                        errorMessage += 'API返回格式错误，请检查API端点是否正确';
                    } else {
                        errorMessage += error.message;
                    }
                    
                    testResultDiv.textContent = '✗ ' + errorMessage;
                    testResultDiv.style.color = '#f44336';
                    alert(errorMessage + '\n\n详细信息请查看浏览器控制台(F12)');
                } finally {
                    testBtn.textContent = originalText;
                    testBtn.disabled = false;
                }
            }

            // 更新头像预览，支持两种不同的预览ID
            function updateAvatarPreview(avatarData) {
                // 处理编辑角色模态框的预览
                const modalPreview = document.getElementById('wechat-avatar-preview');
                if (modalPreview && document.getElementById('wechat-character-modal').classList.contains('active')) {
                    if (avatarData) {
                        modalPreview.innerHTML = `<img src="${avatarData}" alt="头像预览">`;
                    } else {
                        modalPreview.innerHTML = '<i class="fas fa-user"></i>';
                    }
                }
                
                // 处理新建角色页面的预览
                const createPreview = document.getElementById('wechat-create-avatar-preview');
                if (createPreview) {
                    if (avatarData) {
                        createPreview.innerHTML = `<img src="${avatarData}" alt="头像预览">`;
                        // 重新绑定点击事件
                        createPreview.addEventListener('click', () => {
                            document.getElementById('wechat-create-avatar-input').click();
                        });
                    } else {
                        createPreview.innerHTML = '<i class="fas fa-user"></i><div class="wechat-avatar-upload-overlay"><i class="fas fa-camera"></i><span>点击上传</span></div>';
                        // 重新绑定点击事件
                        createPreview.addEventListener('click', () => {
                            document.getElementById('wechat-create-avatar-input').click();
                        });
                    }
                }
            }

            function showWechatCharacterModal(charToEdit = null) {
                const modal = document.getElementById('wechat-character-modal');
                const title = document.getElementById('wechat-char-modal-title');
                const modalPreview = document.getElementById('wechat-avatar-preview');

                if (charToEdit) {
                    title.textContent = '编辑角色';
                    wechatState.editingCharId = charToEdit.id;
                    document.getElementById('wechat-char-name').value = charToEdit.name;
                    document.getElementById('wechat-char-persona').value = charToEdit.persona;
                    document.getElementById('wechat-char-style').value = charToEdit.speakingStyle;
                    document.getElementById('wechat-char-memory').value = Array.isArray(charToEdit.memory) ? charToEdit.memory.join('\n') : (charToEdit.memory || '');
                    // 将角色的头像保存到临时变量
                    window.tempAvatarData = charToEdit.avatar || '';
                    // 更新模态框的头像预览
                    if (modalPreview) {
                        if (charToEdit.avatar) {
                            modalPreview.innerHTML = `<img src="${charToEdit.avatar}" alt="头像预览">`;
                        } else {
                            modalPreview.innerHTML = '<i class="fas fa-user"></i><div class="wechat-avatar-upload-overlay"><i class="fas fa-camera"></i><span>点击上传</span></div>';
                        }
                    }
                } else {
                    title.textContent = '创建角色';
                    wechatState.editingCharId = null;
                    document.getElementById('wechat-char-name').value = '';
                    document.getElementById('wechat-char-persona').value = '';
                    document.getElementById('wechat-char-style').value = '';
                    document.getElementById('wechat-char-memory').value = '';
                    // 重置临时头像数据
                    window.tempAvatarData = '';
                    // 重置模态框的头像预览
                    if (modalPreview) {
                        modalPreview.innerHTML = '<i class="fas fa-user"></i><div class="wechat-avatar-upload-overlay"><i class="fas fa-camera"></i><span>点击上传</span></div>';
                    }
                }

                // 绑定头像上传事件
                const uploadBtn = document.getElementById('wechat-avatar-upload-btn');
                const fileInput = document.getElementById('wechat-char-avatar-input');
                const preview = document.getElementById('wechat-avatar-preview');
                
                if (uploadBtn && fileInput && preview) {
                    uploadBtn.onclick = () => fileInput.click();
                    
                    fileInput.onchange = (e) => {
                        const file = e.target.files[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                                const avatarData = event.target.result;
                                preview.innerHTML = `<img src="${avatarData}" alt="头像预览">`;
                                // 保存到临时变量
                                window.tempAvatarData = avatarData;
                            };
                            reader.readAsDataURL(file);
                        }
                    };
                    
                    // 点击预览区域也可以上传
                    preview.onclick = () => fileInput.click();
                }

                modal.classList.add('active');
            }

            // 头像上传处理
            // 新建角色页面的头像预览点击事件
            const createAvatarPreview = document.getElementById('wechat-create-avatar-preview');
            if (createAvatarPreview) {
                createAvatarPreview.addEventListener('click', () => {
                    document.getElementById('wechat-create-avatar-input').click();
                });
            }
                
                // 新建角色页面的选择图片按钮点击事件
                const createAvatarUploadBtn = document.getElementById('wechat-create-avatar-upload-btn');
                if (createAvatarUploadBtn) {
                    createAvatarUploadBtn.addEventListener('click', () => {
                        document.getElementById('wechat-create-avatar-input').click();
                    });
                }
                
                // 新建角色页面的文件选择事件
                const createAvatarInput = document.getElementById('wechat-create-avatar-input');
                if (createAvatarInput) {
                    createAvatarInput.addEventListener('change', (e) => {
                        const file = e.target.files[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                                updateAvatarPreview(event.target.result);
                                // 保存到临时变量，以便后续使用
                                window.tempAvatarData = event.target.result;
                            };
                            reader.readAsDataURL(file);
                        }
                    });
                }
                
                // 编辑角色模态框的URL输入事件
                const charAvatarInput = document.getElementById('wechat-char-avatar');
                if (charAvatarInput) {
                    charAvatarInput.addEventListener('input', (e) => {
                        updateAvatarPreview(e.target.value.trim());
                    });
                }

            async function saveWechatCharacter() {
                let name, persona, speakingStyle, memory;
                
                // 检查当前是否在模态框中
                const characterModal = document.getElementById('wechat-character-modal');
                // 判断是在模态框中还是在页面中。如果点击的是模态框内的保存按钮，或者是从模态框触发的保存，说明在模态框中
                const isInModal = (characterModal && characterModal.classList.contains('active')) || 
                                  document.activeElement.closest('#wechat-character-modal');
                
                if (isInModal) {
                    // 在模态框中，使用模态框的输入框
                    name = document.getElementById('wechat-char-name')?.value.trim() || '';
                    persona = document.getElementById('wechat-char-persona')?.value || '';
                    speakingStyle = document.getElementById('wechat-char-style')?.value || '';
                    let rawMemory = document.getElementById('wechat-char-memory')?.value || '';
                    memory = rawMemory.split('\n').map(m => m.trim()).filter(m => m !== '');
                } else {
                    // 在创建角色页面，使用创建页面的输入框
                    name = document.getElementById('wechat-create-char-name')?.value.trim() || '';
                    persona = document.getElementById('wechat-create-char-persona')?.value || '';
                    speakingStyle = document.getElementById('wechat-create-char-style')?.value || '';
                    let rawCreateMemory = document.getElementById('wechat-create-char-memory')?.value || '';
                    memory = rawCreateMemory.split('\n').map(m => m.trim()).filter(m => m !== '');
                }
                
                // 只使用本地上传的头像数据
                const avatar = window.tempAvatarData || '';
                
                console.log('保存角色时的调试信息：');
                console.log('name:', name);
                console.log('avatar:', avatar);
                console.log('avatar长度:', avatar.length);
                console.log('window.tempAvatarData:', window.tempAvatarData);
                console.log('isInModal:', isInModal);
                
                if (!name || !avatar || !persona.trim() || !speakingStyle.trim()) {
                    let missing = [];
                    if (!name) missing.push('名字');
                    if (!avatar) missing.push('头像');
                    if (!persona.trim()) missing.push('人设');
                    if (!speakingStyle.trim()) missing.push('说话方式');
                    alert('请填写完整信息：' + missing.join('、') + ' 不能为空！');
                    return false;
                }

                if (wechatState.editingCharId) {
                    // 编辑现有角色
                    const index = wechatState.characters.findIndex(c => c.id === wechatState.editingCharId);
                    const oldChatHistory = wechatState.characters[index].chatHistory;
                    wechatState.characters[index] = {
                        id: wechatState.editingCharId,
                        name,
                        avatar,
                        persona,
                        speakingStyle,
                        memory,
                        chatHistory: oldChatHistory
                    };
                } else {
                    // 创建新角色
                    wechatState.characters.push({
                        id: Date.now(),
                        name,
                        avatar,
                        persona,
                        speakingStyle,
                        memory,
                        chatHistory: []
                    });
                }

                try {
                    // 等待数据保存完成
                    await saveWechatData();
                    // 只有在保存成功后才重置临时头像数据
                    window.tempAvatarData = '';
                    // 然后更新界面
                    renderWechatList();
                    renderWechatContacts();
                    console.log('角色保存成功');
                    return true;
                } catch (error) {
                    console.error('角色保存失败:', error);
                    alert('保存角色失败，请重试');
                    return false;
                }
            }

            // 获取实际使用的模型名称
            function getWechatModel() {
                // 如果当前选中的是'custom'，则返回自定义模型名称
                if (wechatState.settings.model === 'custom') {
                    return wechatState.settings.customModel || 'gpt-4o-mini';
                }
                return wechatState.settings.model;
            }

            // 微信设置保存逻辑已整合到全局点击监听中，此函数保留用于兼容性
            async function saveWechatSettings() {
                // 不再从不存在的 DOM 元素读取 API 配置
                // API 配置现在统一在 API 配置应用中管理
                await saveWechatData();
                applyWechatTheme();
                document.getElementById('wechat-settings-modal').classList.remove('active');
            }

            // Wechat事件监听
            document.addEventListener('click', (e) => {
                // 处理所有微信相关的返回按钮
                const backBtn = e.target.closest('#wechat-header-back-btn, #wechat-chat-back-btn');
                if (backBtn) {
                    // 如果是在朋友圈标签页，返回到聊天标签页
                    const momentsTab = document.getElementById('wechat-moments-tab');
                    if (momentsTab && momentsTab.style.display === 'block') {
                        const chatsNavItem = document.querySelector('.wechat-nav-item[data-tab="chats"]');
                        if (chatsNavItem) chatsNavItem.click();
                        return;
                    }
                    
                    // 否则执行原有的返回聊天列表逻辑
                    closeWechatChat();
                }

                // 发送消息
                if (e.target.id === 'wechat-send') {
                    sendWechatMessage();
                }

                // 创建新角色
                if (e.target.id === 'wechat-add-btn') {
                    showWechatCharacterModal();
                }

                // 关闭模态框
                if (e.target.classList.contains('wechat-close-btn')) {
                    e.target.closest('.wechat-modal').classList.remove('active');
                }

                // 保存设置
                if (e.target.id === 'wechat-save-settings') {
                    e.stopPropagation();
                    e.preventDefault();
                    
                    (async () => {
                        console.log('保存设置按钮被点击');

                        // 保存动作描写设置
                        const allowActionDescBtn = document.getElementById('wechat-allow-action-desc');
                        if (allowActionDescBtn) {
                            wechatState.settings.allowActionDescription = allowActionDescBtn.checked;
                        }

                        // 从localStorage同步最新的API配置（以防在API配置应用中修改了但没同步到内存）
                        const savedApiUrl = localStorage.getItem('wechatApiUrl');
                        const savedApiKey = localStorage.getItem('wechatApiKey');
                        const savedModel = localStorage.getItem('wechatModel');
                        const savedCustomModel = localStorage.getItem('wechatCustomModel');
                        
                        if (savedApiUrl) wechatState.settings.apiUrl = savedApiUrl;
                        if (savedApiKey) wechatState.settings.apiKey = savedApiKey;
                        if (savedModel) {
                            wechatState.settings.model = savedModel;
                        }
                        if (savedCustomModel) wechatState.settings.customModel = savedCustomModel;

                        try {
                            await saveWechatData();
                            console.log('微信数据保存成功');
                            
                            // 显示保存成功提示
                            showWechatAlert('设置保存成功！');
                            
                            // 关闭设置模态框
                            document.getElementById('wechat-settings-modal').classList.remove('active');
                            
                            // 应用主题
                            applyWechatTheme();
                        } catch (error) {
                            console.error('保存微信数据失败:', error);
                            showWechatAlert('保存失败，请重试！');
                        }
                    })();
                }

                // 保存角色
                const saveCharBtn = e.target.closest('#wechat-save-character');
                if (saveCharBtn) {
                    (async () => {
                        console.log('--- GLOBAL SAVE BUTTON CLICKED ---');
                        const success = await saveWechatCharacter();
                        console.log('--- GLOBAL SAVE SUCCESS:', success);
                        if (success === true) {
                            // 关闭模态框
                            const modal = document.getElementById('wechat-character-modal');
                            if (modal) {
                                modal.classList.remove('active');
                            }
                            // 显示创建成功提示
                            alert('【全局提示】角色创建成功！');
                        }
                    })();
                }

                // 确认对话框 - 取消按钮
                if (e.target.id === 'confirm-cancel') {
                    e.stopPropagation();
                    e.preventDefault();
                    document.getElementById('wechat-confirm-modal').classList.remove('active');
                    confirmDialogCallback = null;
                }

                // 确认对话框 - 确认按钮
                if (e.target.id === 'confirm-ok') {
                    e.stopPropagation();
                    e.preventDefault();
                    const confirmModal = document.getElementById('wechat-confirm-modal');
                    if (confirmDialogCallback) {
                        confirmDialogCallback();
                        confirmDialogCallback = null;
                    }
                    confirmModal.classList.remove('active');
                }

                // 提示对话框 - 确定按钮
                if (e.target.id === 'alert-ok') {
                    e.stopPropagation();
                    e.preventDefault();
                    document.getElementById('wechat-alert-modal').classList.remove('active');
                }

                // 打开设置（长按聊天头像）
                if (e.target.id === 'wechat-current-avatar') {
                    const char = wechatState.characters.find(c => c.id == wechatState.activeCharacterId);
                    if (char) {
                        showWechatCharacterModal(char);
                    }
                }
            });



            document.addEventListener('keydown', (e) => {
                if (e.target.id === 'wechat-input' && e.key === 'Enter') {
                    sendWechatMessage();
                }
            });

            // 为微信"我的"页面中的"设置"菜单项添加点击事件
            document.addEventListener('click', (e) => {
                if (e.target.closest('.wechat-menu-item') && e.target.closest('.wechat-menu-item').querySelector('.wechat-menu-text').textContent === '设置') {
                    showWechatSettingsModal();
                }
            });

            // --- 微信标签页切换功能 ---
            const wechatNavItems = document.querySelectorAll('.wechat-nav-item');
            const wechatTabs = document.querySelectorAll('.wechat-tab');
            
            wechatNavItems.forEach(item => {
                item.addEventListener('click', () => {
                    const tabName = item.dataset.tab;
                    
                    // 切换标签页
                    wechatTabs.forEach(tab => {
                        tab.style.display = 'none';
                    });
                    document.getElementById(`wechat-${tabName}-tab`).style.display = 'block';
                    
                    // 更新导航栏激活状态
                    wechatNavItems.forEach(navItem => {
                        navItem.classList.remove('active');
                    });
                    item.classList.add('active');
                    
                    // 获取底部导航栏
                    const wechatNav = document.querySelector('.wechat-nav');
                    const wechatHeaderBackBtn = document.getElementById('wechat-header-back-btn');
                    
                    // 如果进入朋友圈，隐藏底部导航栏，显示返回按钮
                    if (tabName === 'moments') {
                        if (wechatNav) wechatNav.style.display = 'none';
                        if (wechatHeaderBackBtn) wechatHeaderBackBtn.style.display = 'flex';
                    } else {
                        if (wechatNav) wechatNav.style.display = 'flex';
                        if (wechatHeaderBackBtn) wechatHeaderBackBtn.style.display = 'none';
                    }
                    
                    // 更新标题
                    document.getElementById('wechat-header-title').textContent = {
                        'chats': '微信',
                        'contacts': '通讯录',
                        'moments': '发现',
                        'me': ''
                    }[tabName];
                    
                    // 更新右上角按钮显示
                    const wechatPlusBtn = document.getElementById('wechat-plus-btn');
                    
                    // 在"我的"页面隐藏加号按钮
                    if (tabName === 'me') {
                        if (wechatPlusBtn) wechatPlusBtn.style.display = 'none';
                    } else {
                        if (wechatPlusBtn) wechatPlusBtn.style.display = 'flex';
                    }
                    
                    if (wechatPlusBtn) {
                if (tabName === 'moments') {
                    wechatPlusBtn.innerHTML = '<i class="fas fa-camera"></i>';
                } else {
                    wechatPlusBtn.innerHTML = '<i class="fas fa-plus"></i>';
                }
            }
                    
                    // 控制搜索按钮显示/隐藏
                    if (wechatSearchBtn) {
                        if (tabName === 'moments') {
                            wechatSearchBtn.style.display = 'none';
                        } else {
                            wechatSearchBtn.style.display = 'block';
                        }
                    }
                    
                    // 渲染通讯录联系人
                    if (tabName === 'contacts') {
                        renderWechatContacts();
                    }
                    
                    // 渲染个人资料
                    if (tabName === 'me') {
                        renderWechatProfile();
                    }
                });
            });
            
            // --- 微信通讯录功能 ---
            function renderWechatContacts() {
                const contactsList = document.getElementById('wechat-contacts-list');
                if (!contactsList) return;
                
                console.log('渲染通讯录，角色数量:', wechatState.characters.length);
                console.log('角色列表:', wechatState.characters);
                
                contactsList.innerHTML = wechatState.characters.map(char => {
                    return `
                        <div class="wechat-contact-item" data-char-id="${char.id}">
                            <div class="wechat-contact-avatar-container">
                                ${renderAvatarHtml(char.avatar, 'wechat-contact-avatar')}
                            </div>
                            <div class="wechat-contact-info">
                                <div class="wechat-contact-name">${char.name}</div>
                                <div class="wechat-contact-status">${char.persona.substring(0, 20)}${char.persona.length > 20 ? '...' : ''}</div>
                            </div>
                            <button class="wechat-contact-delete" data-char-id="${char.id}"><i class="fas fa-trash"></i></button>
                        </div>
                    `;
                }).join('');
                
                // 绑定点击事件
                contactsList.querySelectorAll('.wechat-contact-item').forEach(item => {
                    item.addEventListener('click', (e) => {
                        if (!e.target.closest('.wechat-contact-delete')) {
                            const charId = parseInt(item.dataset.charId);
                            const char = wechatState.characters.find(c => c.id == charId);
                            if (char) {
                                showWechatCharacterModal(char);
                            }
                        }
                    });
                });
                
                // 绑定删除按钮事件
                contactsList.querySelectorAll('.wechat-contact-delete').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const charId = parseInt(btn.dataset.charId);
                        deleteContact(charId);
                    });
                });
            }
            
            // 删除联系人功能
            function deleteContact(charId) {
                if (confirm('确定要删除这个联系人吗？')) {
                    // 从角色列表中移除
                    wechatState.characters = wechatState.characters.filter(c => c.id !== charId);
                    // 保存数据
                    saveWechatData();
                    // 重新渲染联系人列表和聊天列表
                    renderWechatContacts();
                    renderWechatList();
                    // 如果当前正在聊天的是被删除的联系人，返回聊天列表
                    if (wechatState.activeCharacterId === charId) {
                        closeWechatChat();
                    }
                }
            }
            
            // 添加联系人按钮事件
            document.getElementById('wechat-add-contact').addEventListener('click', () => {
                // 显示独立的角色创建页面
                const createCharTab = document.getElementById('wechat-create-char-tab');
                const chatsTab = document.getElementById('wechat-chats-tab');
                const contactsTab = document.getElementById('wechat-contacts-tab');
                const momentsTab = document.getElementById('wechat-moments-tab');
                const meTab = document.getElementById('wechat-me-tab');
                
                // 隐藏所有其他标签页
                chatsTab.style.display = 'none';
                contactsTab.style.display = 'none';
                momentsTab.style.display = 'none';
                meTab.style.display = 'none';
                
                // 显示创建角色页面
                createCharTab.style.display = 'block';
                
                // 更新标题
                document.getElementById('wechat-header-title').textContent = '';
                
                // 隐藏头部按钮
                document.getElementById('wechat-plus-btn').style.display = 'none';
            });
            
            // 创建角色页面返回按钮事件
            function setupCreateCharButtons() {
                // 等待DOM加载完成后再绑定事件
                const createCharBackBtn = document.getElementById('create-char-back-btn');
                if (createCharBackBtn) {
                    createCharBackBtn.addEventListener('click', () => {
                        console.log('点击了创建角色页面的返回按钮');
                        const createCharTab = document.getElementById('wechat-create-char-tab');
                        const contactsTab = document.getElementById('wechat-contacts-tab');
                        
                        // 隐藏创建角色页面，显示通讯录页面
                        createCharTab.style.display = 'none';
                        contactsTab.style.display = 'block';
                        
                        // 更新标题
                        document.getElementById('wechat-header-title').textContent = '通讯录';
                        
                        // 显示头部按钮
                        document.getElementById('wechat-plus-btn').style.display = 'flex';
                    });
                }
                
                // 创建角色页面取消按钮事件
                const createCharCancelBtn = document.getElementById('create-char-cancel-btn');
                if (createCharCancelBtn) {
                    createCharCancelBtn.addEventListener('click', () => {
                        console.log('点击了创建角色页面的取消按钮');
                        const createCharTab = document.getElementById('wechat-create-char-tab');
                        const contactsTab = document.getElementById('wechat-contacts-tab');
                        
                        // 隐藏创建角色页面，显示通讯录页面
                        createCharTab.style.display = 'none';
                        contactsTab.style.display = 'block';
                        
                        // 更新标题
                        document.getElementById('wechat-header-title').textContent = '通讯录';
                        
                        // 显示头部按钮
                        document.getElementById('wechat-plus-btn').style.display = 'flex';
                    });
                }
                
                // 创建角色页面保存按钮事件
                const createCharSaveBtn = document.getElementById('create-char-save-btn');
                if (createCharSaveBtn) {
                    // 使用 onclick 确保不会重复绑定多个事件
                    createCharSaveBtn.onclick = async () => {
                        console.log('点击了创建角色页面的保存按钮');
                        // 调用保存函数
                        const success = await saveWechatCharacter();
                        
                        // 只有在保存成功后才显示成功提示和返回通讯录页面
                        if (success) {
                            console.log('角色创建成功，准备返回通讯录页面');
                            // 显示创建成功提示
                            alert('【页面提示】角色创建成功！');
                            
                            // 保存后返回通讯录页面
                            const createCharTab = document.getElementById('wechat-create-char-tab');
                            const contactsTab = document.getElementById('wechat-contacts-tab');
                            
                            // 隐藏创建角色页面，显示通讯录页面
                            createCharTab.style.display = 'none';
                            contactsTab.style.display = 'block';
                            
                            // 更新标题
                            document.getElementById('wechat-header-title').textContent = '通讯录';
                            
                            // 显示头部按钮
                            document.getElementById('wechat-plus-btn').style.display = 'flex';
                        }
                    };
                }
            }
            
            // 页面加载完成后设置创建角色页面的按钮事件
            setupCreateCharButtons();
            
            // 设置创建角色页面的头像上传事件
            function setupCreateCharAvatarEvents() {
                // 新建角色页面的头像预览点击事件
                const createAvatarPreview = document.getElementById('wechat-create-avatar-preview');
                if (createAvatarPreview) {
                    // 先移除可能存在的事件监听器，避免重复绑定
                    createAvatarPreview.onclick = null;
                    createAvatarPreview.addEventListener('click', () => {
                        document.getElementById('wechat-create-avatar-input').click();
                    });
                }
                
                // 新建角色页面的选择图片按钮点击事件
                const createAvatarUploadBtn = document.getElementById('wechat-create-avatar-upload-btn');
                if (createAvatarUploadBtn) {
                    // 先移除可能存在的事件监听器，避免重复绑定
                    createAvatarUploadBtn.onclick = null;
                    createAvatarUploadBtn.addEventListener('click', () => {
                        document.getElementById('wechat-create-avatar-input').click();
                    });
                }
                
                // 新建角色页面的文件选择事件
                const createAvatarInput = document.getElementById('wechat-create-avatar-input');
                if (createAvatarInput) {
                    // 先移除可能存在的事件监听器，避免重复绑定
                    createAvatarInput.onchange = null;
                    createAvatarInput.addEventListener('change', (e) => {
                        const file = e.target.files[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                                updateAvatarPreview(event.target.result);
                                // 保存到临时变量，以便后续使用
                                window.tempAvatarData = event.target.result;
                            };
                            reader.readAsDataURL(file);
                        }
                    });
                }
            }
            
            // 当创建角色页面显示时，重新设置按钮事件
            document.getElementById('wechat-add-contact').addEventListener('click', () => {
                // 显示独立的角色创建页面
                const createCharTab = document.getElementById('wechat-create-char-tab');
                const chatsTab = document.getElementById('wechat-chats-tab');
                const contactsTab = document.getElementById('wechat-contacts-tab');
                const momentsTab = document.getElementById('wechat-moments-tab');
                const meTab = document.getElementById('wechat-me-tab');
                
                // 隐藏其他页面，显示创建角色页面
                chatsTab.style.display = 'none';
                contactsTab.style.display = 'none';
                momentsTab.style.display = 'none';
                meTab.style.display = 'none';
                createCharTab.style.display = 'block';
                
                // 清空顶部标题，只保留创建角色页面内部的标题
                document.getElementById('wechat-header-title').textContent = '';
                
                // 隐藏头部按钮
                document.getElementById('wechat-plus-btn').style.display = 'none';
                
                // 重新设置按钮事件，确保事件绑定正确
                setTimeout(() => {
                    setupCreateCharButtons();
                    setupCreateCharAvatarEvents();
                }, 100);
            });
            
            // 重写渲染函数，确保通讯录和聊天列表同步
            const originalRenderWechatList = renderWechatList;
            renderWechatList = function() {
                originalRenderWechatList();
                renderWechatContacts();
            };
            
            // --- 微信朋友圈功能 --- 
            
            // 渲染朋友圈列表
            function renderWechatMoments() {
                const momentsList = document.getElementById('wechat-moments-list');
                const momentsProfileAvatar = document.getElementById('moments-profile-avatar');
                if (!momentsList) return;
                
                // 更新朋友圈顶部封面头像
                renderAvatarInto(momentsProfileAvatar, wechatState.profile.avatar || '', 'moments-profile-avatar-media');
                
                momentsList.innerHTML = wechatState.moments.map(moment => {
                    const momentAvatar = moment.avatar || (moment.userId === 'currentUser' ? wechatState.profile.avatar : '');
                    const avatarHtml = `<div class="moments-user-avatar-container">${renderAvatarHtml(momentAvatar, 'moments-user-avatar')}</div>`;
                    
                    return `
                        <div class="moments-item" data-moment-id="${moment.id}">
                            <div class="moments-item-header">
                                ${avatarHtml}
                                <div class="moments-user-info">
                                    <div class="moments-user-name">${moment.userId === 'currentUser' ? (wechatState.profile.nickname || '我') : moment.userName}</div>
                                    <div class="moments-post-time">${formatTime(moment.timestamp)}</div>
                                </div>
                                ${moment.userId === 'currentUser' || moment.userId.startsWith('char_') ? `
                                    <div class="moments-more" data-moment-id="${moment.id}">
                                        <i class="fas fa-ellipsis-h"></i>
                                    </div>
                                ` : ''}
                            </div>
                            <div class="moments-content">
                                <p>${moment.content}</p>
                                ${moment.location ? `
                                    <div class="moments-location" style="display: flex; align-items: center; color: #c5a059; margin-top: 8px; font-size: 12px; opacity: 0.6;">
                                        <i class="fas fa-map-marker-alt" style="margin-right: 6px;"></i>
                                        <span>${moment.location.name}</span>
                                    </div>
                                ` : ''}
                            </div>
                            ${moment.images.length > 0 ? `
                                <div class="moments-image-grid">
                                    ${moment.images.map(img => `<img src="${img}" alt="朋友圈图片" class="moments-image">`).join('')}
                                </div>
                            ` : ''}
                            ${moment.video ? `
                                <div class="moments-video-container" style="position: relative; width: calc(100% - 60px); margin-left: 60px; margin-bottom: 16px; border-radius: 12px; overflow: hidden; background: #1c1c1e;">
                                    <video src="${moment.video}" class="moments-video" controls preload="metadata" style="width: 100%; height: auto; display: block; filter: brightness(0.8);"></video>
                                </div>
                            ` : ''}
                            <div class="moments-actions" data-moment-id="${moment.id}">
                                <div class="moments-action like-btn ${moment.likes.includes('currentUser') ? 'liked' : ''}"><i class="${moment.likes.includes('currentUser') ? 'fas' : 'far'} fa-heart"></i> ${moment.likes.length || ''}</div>
                                <div class="moments-action comment-btn"><i class="far fa-comment"></i> ${moment.comments.length || ''}</div>
                            </div>
                            ${moment.likes.length > 0 || moment.comments.length > 0 ? `
                                <div class="moments-interactions" style="margin: 0 24px 0 68px; background: rgba(0,0,0,0.03); border-radius: 6px; padding: 8px 12px; margin-bottom: 20px;">
                                    ${moment.likes.length > 0 ? `
                                        <div class="moments-likes" style="font-size: 13px; color: #b89d6d; margin-bottom: ${moment.comments.length > 0 ? '6px' : '0'}; border-bottom: ${moment.comments.length > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none'}; padding-bottom: ${moment.comments.length > 0 ? '6px' : '0'};">
                                            <i class="far fa-heart" style="margin-right: 6px;"></i>
                                            ${moment.likes.map(id => {
                                                if (id === 'currentUser') return wechatState.profile.nickname || '我';
                                                const charId = String(id).replace('char_', '');
                                                const char = wechatState.characters.find(c => c.id === Number(charId) || c.id === charId);
                                                return char ? char.name : (id === 'other' ? '李四' : '未知');
                                            }).join(', ')}
                                        </div>
                                    ` : ''}
                                    ${moment.comments.length > 0 ? `
                                        <div class="moments-comments-list" style="display: flex; flex-direction: column; gap: 4px;">
                                            ${moment.comments.map(comment => {
                                                const isCurrentUser = comment.userId === 'currentUser';
                                                const userName = isCurrentUser ? (wechatState.profile.nickname || '我') : comment.userName;
                                                return `
                                                    <div class="moment-comment" style="font-size: 14px; line-height: 1.5; color: #333;">
                                                        <span style="color: #b89d6d; font-weight: 500; cursor: pointer;">${userName}</span>: <span>${comment.content}</span>
                                                    </div>
                                                `;
                                            }).join('')}
                                        </div>
                                    ` : ''}
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('');
                
                // 绑定更多按钮事件
                const moreBtns = momentsList.querySelectorAll('.moments-more');
                moreBtns.forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation(); // 阻止事件冒泡到document
                        const momentId = Number(btn.dataset.momentId) || btn.dataset.momentId;
                        showMoreMenu(e, momentId);
                    });
                });

                // 绑定点赞按钮事件
                const likeBtns = momentsList.querySelectorAll('.like-btn');
                likeBtns.forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const momentId = Number(btn.parentElement.dataset.momentId) || btn.parentElement.dataset.momentId;
                        toggleMomentLike(momentId);
                    });
                });

                // 绑定评论按钮事件
                const commentBtns = momentsList.querySelectorAll('.comment-btn');
                commentBtns.forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const momentId = Number(btn.parentElement.dataset.momentId) || btn.parentElement.dataset.momentId;
                        showCommentInput(momentId);
                    });
                });
            }
            
            // 格式化时间
            function formatTime(timestamp) {
                const now = Date.now();
                const date = new Date(timestamp);
                
                // 检查时间戳是否有效
                if (isNaN(date.getTime())) {
                    const currentDate = new Date();
                    const year = currentDate.getFullYear();
                    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                    const day = String(currentDate.getDate()).padStart(2, '0');
                    const hours = String(currentDate.getHours()).padStart(2, '0');
                    const minutes = String(currentDate.getMinutes()).padStart(2, '0');
                    return `${year}-${month}-${day} ${hours}:${minutes}`;
                }
                
                const diff = now - timestamp;
                
                // 格式化具体时间为：yyyy-MM-dd HH:mm
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                const fullTime = `${year}-${month}-${day} ${hours}:${minutes}`;
                
                if (diff < 60000) { // 1分钟内
                    return `刚刚 ${fullTime}`;
                } else if (diff < 3600000) { // 1小时内
                    return `${Math.floor(diff / 60000)}分钟前 ${fullTime}`;
                } else if (diff < 86400000) { // 1天内
                    return `${Math.floor(diff / 3600000)}小时前 ${fullTime}`;
                } else if (diff < 604800000) { // 1周内
                    return `${Math.floor(diff / 86400000)}天前 ${fullTime}`;
                } else {
                    return fullTime;
                }
            }
            
            // 点赞/取消点赞
            function toggleMomentLike(momentId) {
                const moment = wechatState.moments.find(m => m.id === momentId);
                if (!moment) return;
                
                const currentUser = 'currentUser'; // 假设当前用户ID
                const likeIndex = moment.likes.indexOf(currentUser);
                
                if (likeIndex > -1) {
                    moment.likes.splice(likeIndex, 1);
                } else {
                    moment.likes.push(currentUser);
                }
                
                saveWechatData();
                renderWechatMoments();
            }
            
            // 显示/隐藏评论输入框
            function showCommentInput(momentId) {
                const momentEl = document.querySelector(`.moments-item[data-moment-id="${momentId}"]`);
                if (!momentEl) return;
                
                let inputContainer = momentEl.querySelector('.moment-comment-input-container');
                if (inputContainer) {
                    // 如果已存在则移除（切换显示/隐藏）
                    inputContainer.remove();
                    return;
                }
                
                // 创建输入框
                inputContainer = document.createElement('div');
                inputContainer.className = 'moment-comment-input-container';
                inputContainer.style.cssText = 'margin: 0 24px 20px 68px; display: flex; gap: 8px; align-items: center;';
                
                inputContainer.innerHTML = `
                    <input type="text" class="moment-comment-input" placeholder="评论..." style="flex: 1; border: 1px solid rgba(0,0,0,0.1); border-radius: 6px; padding: 8px 12px; font-size: 14px; outline: none; background: #fff;">
                    <button class="moment-comment-submit" style="background: #07c160; color: #fff; border: none; border-radius: 6px; padding: 8px 16px; font-size: 14px; font-weight: 500; cursor: pointer;">发送</button>
                `;
                
                // 插入到互动区之前，如果没有互动区则插入到末尾
                const interactionsEl = momentEl.querySelector('.moments-interactions');
                if (interactionsEl) {
                    momentEl.insertBefore(inputContainer, interactionsEl);
                } else {
                    momentEl.appendChild(inputContainer);
                }
                
                const inputEl = inputContainer.querySelector('.moment-comment-input');
                const submitBtn = inputContainer.querySelector('.moment-comment-submit');
                
                // 自动获取焦点
                setTimeout(() => inputEl.focus(), 50);
                
                // 绑定发送事件
                const submitComment = () => {
                    const content = inputEl.value.trim();
                    if (content) {
                        addComment(momentId, content, 'currentUser');
                        inputContainer.remove();
                    }
                };
                
                submitBtn.addEventListener('click', submitComment);
                inputEl.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        submitComment();
                    }
                });
            }

            async function addComment(momentId, content, userId) {
                const moment = wechatState.moments.find(m => m.id === momentId);
                if (!moment) return;
                
                moment.comments.push({
                    id: Date.now() + Math.random(),
                    userId: userId,
                    userName: userId === 'currentUser' ? (wechatState.profile.nickname || '我') : (wechatState.characters.find(c => c.id === userId || 'char_'+c.id === userId)?.name || '未知'),
                    content: content,
                    timestamp: Date.now()
                });
                
                saveWechatData();
                renderWechatMoments();

                // 如果是对AI角色的朋友圈发表评论，或者是其他角色对该AI角色的朋友圈发表了评论（目前主要是用户评论AI）
                if (moment.userId.startsWith('char_') && userId === 'currentUser') {
                    const charIdStr = moment.userId.replace('char_', '');
                    const charId = Number(charIdStr);
                    const char = wechatState.characters.find(c => c.id == charId);
                    
                    if (char) {
                        // 触发角色思考并可能回复
                        triggerCharReplyMoment(char, moment, content);
                    }
                }
            }

            // 触发角色回复朋友圈评论
            async function triggerCharReplyMoment(char, moment, userComment) {
                if (!wechatState.settings.apiKey) return;
                
                const systemPrompt = `你现在进入深度角色扮演模式。
# 核心准则：你必须完全化身为角色"${char.name}"。
你的性格：${char.persona}
你的说话风格：${char.speakingStyle}

# 任务
这是你发布的一条朋友圈：
内容：${moment.content}

用户对你的朋友圈发表了评论：
用户评论：${userComment}

请以角色的身份，根据你的人设和语境，回复用户的这条评论。
直接输出回复的文本内容，不要包含任何多余的话语或标签。字数尽量控制在30字以内。如果觉得不需要回复也可以回复"不回复"（三个字）。`;

                try {
                    let chatUrl = wechatState.settings.apiUrl;
                    if (!chatUrl.includes('/chat/completions') && !chatUrl.includes('/completions')) {
                        chatUrl = chatUrl.endsWith('/') ? chatUrl + 'chat/completions' : chatUrl + '/chat/completions';
                    }

                    const response = await fetch(chatUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${wechatState.settings.apiKey}`
                        },
                        body: JSON.stringify({
                            model: getWechatModel(),
                            messages: [{ role: 'system', content: systemPrompt }],
                            temperature: 0.8
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const replyContent = data.choices[0].message.content.trim();
                        
                        if (replyContent !== "不回复" && !replyContent.includes("不回复")) {
                            moment.comments.push({
                                id: Date.now() + Math.random(),
                                userId: 'char_' + char.id,
                                userName: char.name,
                                content: `回复 ${wechatState.profile.nickname || '我'}：${replyContent}`,
                                timestamp: Date.now()
                            });
                            saveWechatData();
                            renderWechatMoments();
                        }
                    }
                } catch (error) {
                    console.error('自动回复朋友圈评论错误:', error);
                }
            }
            
            // 编辑和删除朋友圈功能
            let editingMomentId = null;
            let deletingMomentId = null;
            let activeMoreMenu = null;
            
            // 删除朋友圈确认模态框
            const momentsDeleteModal = document.getElementById('moments-delete-modal');
            const momentsDeleteModalClose = document.getElementById('moments-delete-modal-close');
            const momentsDeleteCancelBtn = document.getElementById('moments-delete-cancel-btn');
            const momentsDeleteConfirmBtn = document.getElementById('moments-delete-confirm-btn');
            
            // 关闭删除确认模态框
            function closeDeleteModal() {
                momentsDeleteModal.classList.remove('active');
                deletingMomentId = null;
            }
            
            // 绑定删除模态框关闭事件
            if (momentsDeleteModalClose) momentsDeleteModalClose.addEventListener('click', closeDeleteModal);
            if (momentsDeleteCancelBtn) momentsDeleteCancelBtn.addEventListener('click', closeDeleteModal);
            
            // 点击模态框外部关闭
            momentsDeleteModal.addEventListener('click', (e) => {
                if (e.target === momentsDeleteModal) {
                    closeDeleteModal();
                }
            });
            
            // 删除朋友圈
            function deleteMoment(momentId) {
                deletingMomentId = momentId;
                momentsDeleteModal.classList.add('active');
                closeMoreMenu();
            }
            
            // 确认删除朋友圈
            if (momentsDeleteConfirmBtn) {
                momentsDeleteConfirmBtn.addEventListener('click', () => {
                    if (deletingMomentId) {
                        const momentIndex = wechatState.moments.findIndex(m => m.id === deletingMomentId);
                        if (momentIndex > -1) {
                            wechatState.moments.splice(momentIndex, 1);
                            saveWechatData();
                            renderWechatMoments();
                            closeDeleteModal();
                        }
                    }
                });
            }
            
            // 编辑朋友圈
            function editMoment(momentId) {
                const moment = wechatState.moments.find(m => m.id === momentId);
                if (moment) {
                    editingMomentId = momentId;
                    const momentsContent = document.getElementById('moments-content');
                    const momentsPostModal = document.getElementById('moments-post-modal');
                    const momentsPublishBtn = document.getElementById('moments-publish-btn');
                    
                    // 设置模态框标题和内容
                    momentsPublishBtn.textContent = '保存修改';
                    momentsContent.value = moment.content;
                    momentsPostModal.classList.add('active');
                    closeMoreMenu();
                }
            }
            
            // 显示更多菜单
            function showMoreMenu(e, momentId) {
                e.stopPropagation();
                closeMoreMenu();
                
                const moreBtn = e.target.closest('.moments-more');
                if (moreBtn) {
                    const menu = document.createElement('div');
                    menu.className = 'moments-more-menu';
                    menu.style.cssText = `
                        position: fixed;
                        right: 20px;
                        top: ${e.clientY + 20}px;
                        background: white;
                        border-radius: 8px;
                        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
                        z-index: 9999;
                        overflow: visible;
                        min-width: 100px;
                        pointer-events: auto;
                    `;
                    
                    // 创建编辑菜单项
                    const editItem = document.createElement('div');
                    editItem.className = 'moments-more-menu-item';
                    editItem.textContent = '编辑';
                    editItem.style.cssText = 'padding: 12px 16px; cursor: pointer; font-size: 14px; color: #1d1d1f; border-bottom: 1px solid #f0f0f0; display: block;';
                    editItem.addEventListener('click', () => editMoment(momentId));
                    
                    // 创建删除菜单项
                    const deleteItem = document.createElement('div');
                    deleteItem.className = 'moments-more-menu-item';
                    deleteItem.textContent = '删除';
                    deleteItem.style.cssText = 'padding: 12px 16px; cursor: pointer; font-size: 14px; color: #ff3b30; display: block;';
                    deleteItem.addEventListener('click', () => deleteMoment(momentId));
                    
                    // 添加菜单项到菜单
                    menu.appendChild(editItem);
                    menu.appendChild(deleteItem);
                    
                    const momentItem = moreBtn.closest('.moments-item');
                    momentItem.style.position = 'relative';
                    momentItem.appendChild(menu);
                    activeMoreMenu = menu;
                }
            }
            
            // 关闭更多菜单
            function closeMoreMenu() {
                if (activeMoreMenu) {
                    activeMoreMenu.remove();
                    activeMoreMenu = null;
                }
            }
            
            // 点击页面其他地方关闭更多菜单
            document.addEventListener('click', (e) => {
                // 只有当点击的不是更多按钮、菜单本身或菜单的子元素时，才关闭菜单
                if (!e.target.closest('.moments-more') && !e.target.closest('.moments-more-menu')) {
                    closeMoreMenu();
                }
            });
            
            // 发布朋友圈模态框
            const momentsPostModal = document.getElementById('moments-post-modal');
            const momentsPostBtn = document.querySelector('.moments-post-btn');
            const momentsModalClose = document.getElementById('moments-modal-close');
            const momentsCancelBtn = document.getElementById('moments-cancel-btn');
            const momentsPublishBtn = document.getElementById('moments-publish-btn');
            const momentsContent = document.getElementById('moments-content');
            
            // 打开发布模态框
            if (momentsPostBtn) {
                momentsPostBtn.addEventListener('click', () => {
                    momentsPostModal.classList.add('active');
                });
            }
            
            // 获取图片和视频输入元素
            const momentsImageInput = document.getElementById('moments-image-input');
            const momentsVideoInput = document.getElementById('moments-video-input');
            const momentsImagesContainer = document.getElementById('moments-images-container');
            const momentsImagesPreview = document.getElementById('moments-images-preview');
            
            // 存储当前选中的媒体文件
            let selectedImages = [];
            let selectedVideo = null;
            let selectedLocation = null;
            
            // 图片预览功能 (朋友圈发布预览)
            function renderMomentsMediaPreview(file, base64Url) {
                const previewDiv = document.createElement('div');
                previewDiv.style.position = 'relative';
                previewDiv.style.marginRight = '10px';
                previewDiv.style.width = '80px';
                previewDiv.style.height = '80px';
                previewDiv.style.borderRadius = '8px';
                previewDiv.style.overflow = 'hidden';
                
                const img = document.createElement('img');
                img.src = base64Url;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                
                const deleteBtn = document.createElement('button');
                deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
                deleteBtn.style.position = 'absolute';
                deleteBtn.style.top = '4px';
                deleteBtn.style.right = '4px';
                deleteBtn.style.width = '20px';
                deleteBtn.style.height = '20px';
                deleteBtn.style.borderRadius = '50%';
                deleteBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
                deleteBtn.style.color = 'white';
                deleteBtn.style.border = 'none';
                deleteBtn.style.fontSize = '12px';
                deleteBtn.style.display = 'flex';
                deleteBtn.style.alignItems = 'center';
                deleteBtn.style.justifyContent = 'center';
                deleteBtn.style.cursor = 'pointer';
                deleteBtn.onclick = () => {
                    // 从预览中移除
                    previewDiv.remove();
                    // 从数组中移除
                    selectedImages = selectedImages.filter(imgObj => imgObj.url !== base64Url);
                    // 如果没有图片了，隐藏预览区域
                    if (selectedImages.length === 0) {
                        momentsImagesPreview.style.display = 'none';
                    }
                };
                
                previewDiv.appendChild(img);
                previewDiv.appendChild(deleteBtn);
                momentsImagesContainer.appendChild(previewDiv);
                
                // 显示预览区域
                momentsImagesPreview.style.display = 'block';
            }
            
            // 为发布模态框中的操作按钮添加点击事件
            const momentsPostActions = document.querySelectorAll('.moments-post-action-btn');
            momentsPostActions.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const action = btn.getAttribute('data-action');
                    
                    if (action === 'image') {
                        // 图片功能
                        momentsImageInput.click();
                    } else if (action === 'video') {
                        // 视频功能
                        momentsVideoInput.click();
                    } else if (action === 'location') {
                        // 位置功能
                        // 这里可以实现位置选择，暂时使用模拟位置
                        selectedLocation = {
                            name: '北京市朝阳区',
                            address: '北京市朝阳区建国路88号'
                        };
                        alert(`已选择位置：${selectedLocation.name}`);
                    } else if (action === 'emoji') {
                        // 表情功能
                        // 这里可以实现表情选择，暂时使用简单的表情插入
                        const emoji = '😊';
                        const content = momentsContent.value;
                        momentsContent.value = content + emoji;
                    }
                });
            });
            
            // 监听图片选择
            momentsImageInput.addEventListener('change', (e) => {
                const files = Array.from(e.target.files);
                files.forEach(file => {
                    if (file.type.startsWith('image/')) {
                        // 限制图片数量（最多9张）
                        if (selectedImages.length < 9) {
                            // 使用FileReader将文件转换为Base64
                            const reader = new FileReader();
                            reader.onload = (e) => {
                                const base64Url = e.target.result;
                                selectedImages.push({ file, url: base64Url });
                                renderMomentsMediaPreview(file, base64Url);
                            };
                            reader.readAsDataURL(file);
                        } else {
                            alert('最多只能选择9张图片');
                        }
                    }
                });
                // 清空文件输入，允许重复选择同一文件
                e.target.value = '';
            });
            
            // 监听视频选择
            momentsVideoInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file && file.type.startsWith('video/')) {
                    // 检查文件大小（限制为10MB）
                    if (file.size > 10 * 1024 * 1024) {
                        alert('视频大小不能超过10MB');
                        return;
                    }
                    
                    // 使用FileReader将文件转换为Base64
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const base64Url = e.target.result;
                        selectedVideo = { file, url: base64Url };
                        alert('视频已选择，支持视频发布');
                    };
                    reader.readAsDataURL(file);
                }
                // 清空文件输入
                e.target.value = '';
            });
            
            // 关闭发布模态框
            function closeMomentsModal() {
                momentsPostModal.classList.remove('active');
                momentsContent.value = '';
                editingMomentId = null;
                momentsPublishBtn.textContent = '发布';
                
                // 清空媒体选择
                selectedImages = [];
                selectedVideo = null;
                selectedLocation = null;
                momentsImagesContainer.innerHTML = '';
                momentsImagesPreview.style.display = 'none';
            }
            
            if (momentsModalClose) momentsModalClose.addEventListener('click', closeMomentsModal);
            if (momentsCancelBtn) momentsCancelBtn.addEventListener('click', closeMomentsModal);
            
            // 点击模态框外部关闭
            momentsPostModal.addEventListener('click', (e) => {
                if (e.target === momentsPostModal) {
                    closeMomentsModal();
                }
            });
            
            // 发布或更新朋友圈
            if (momentsPublishBtn) {
                momentsPublishBtn.addEventListener('click', () => {
                    const content = momentsContent.value.trim();
                    
                    // 准备媒体数据
                    const images = selectedImages.map(img => img.url);
                    const video = selectedVideo ? selectedVideo.url : null;
                    
                    // 验证：内容或媒体至少要有一个
                    if (!content && images.length === 0 && !video) {
                        alert('请输入内容或添加媒体');
                        return;
                    }
                    
                    try {
                        if (editingMomentId) {
                            // 更新现有朋友圈
                            const moment = wechatState.moments.find(m => m.id === editingMomentId);
                            if (moment) {
                                moment.content = content;
                                moment.images = images;
                                moment.video = video;
                                moment.location = selectedLocation;
                                saveWechatData();
                                renderWechatMoments();
                                editingMomentId = null;
                                console.log('朋友圈更新成功:', moment);
                            } else {
                                console.error('更新失败：未找到对应朋友圈');
                                alert('更新失败：未找到对应朋友圈');
                            }
                        } else {
                            // 创建新的朋友圈
                            const newMoment = {
                                id: Date.now(),
                                userId: 'currentUser',
                                userName: wechatState.profile.nickname || '我',
                                avatar: wechatState.profile.avatar || 'https://image-1306385190.cos.ap-nanjing.myqcloud.com/gpt/avatar_user.png',
                                content: content,
                                images: images,
                                video: video,
                                location: selectedLocation,
                                timestamp: Date.now(),
                                likes: [],
                                comments: []
                            };
                            
                            // 确保moments数组存在
                            if (!Array.isArray(wechatState.moments)) {
                                wechatState.moments = [];
                            }
                            
                            // 添加到朋友圈列表
                            wechatState.moments.unshift(newMoment);
                            
                            // 保存数据并重新渲染
                            saveWechatData();
                            renderWechatMoments();
                            
                            console.log('朋友圈发布成功:', newMoment);
                            console.log('当前moments数组:', wechatState.moments);
                        }
                        
                        // 关闭模态框
                        closeMomentsModal();
                    } catch (error) {
                        console.error('发布/更新朋友圈时出错:', error);
                        console.error('错误类型:', error.name);
                        console.error('错误信息:', error.message);
                        
                        // 提供更具体的错误信息
                        if (error.name === 'QuotaExceededError') {
                            alert('发布失败：存储空间不足，建议清理旧的朋友圈内容');
                        } else if (error.name === 'TypeError') {
                            alert('发布失败：数据格式错误');
                        } else {
                            alert('发布失败：' + error.message + '，请重试');
                        }
                    }
                });
            }
            
            // 为朋友圈标签页添加激活事件
            wechatNavItems.forEach(item => {
                if (item.dataset.tab === 'moments') {
                    item.addEventListener('click', () => {
                        renderWechatMoments();
                    });
                }
            });
            
            // --- 微信右上角加号菜单功能 --- 
            const wechatPlusBtn = document.getElementById('wechat-plus-btn');
            const wechatPlusMenu = document.getElementById('wechat-plus-menu');
            
            // 切换加号菜单显示/隐藏 - 朋友圈界面除外
            if (wechatPlusBtn && wechatPlusMenu) {
                wechatPlusBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // 检查当前是否在朋友圈界面
                    const currentTab = document.querySelector('.wechat-nav-item.active').dataset.tab;
                    if (currentTab === 'moments') {
                        // 朋友圈界面点击摄像头图标打开发布模态框
                        const momentsPostModal = document.getElementById('moments-post-modal');
                        if (momentsPostModal) {
                            momentsPostModal.classList.add('active');
                        }
                    } else {
                        wechatPlusMenu.classList.toggle('show');
                    }
                });
            }
            
            // 点击菜单外部关闭菜单
            document.addEventListener('click', (e) => {
                if (!wechatPlusMenu.contains(e.target) && e.target !== wechatPlusBtn) {
                    wechatPlusMenu.classList.remove('show');
                }
            });
            
            // 处理菜单点击事件
            if (wechatPlusMenu) {
                wechatPlusMenu.addEventListener('click', (e) => {
                    const menuItem = e.target.closest('.wechat-plus-menu-item');
                    if (menuItem) {
                        const menuText = menuItem.querySelector('span').textContent;
                        
                        switch(menuText) {
                            case '发起群聊':
                                openCreateGroupModal();
                                break;
                            case '添加朋友':
                                // 打开添加联系人功能
                                showWechatCharacterModal();
                                break;
                            case '扫一扫':
                                openScanView();
                                break;
                            case '收付款':
                                alert('收付款功能开发中');
                                break;
                            default:
                                break;
                        }
                        
                        // 关闭菜单
                        wechatPlusMenu.classList.remove('show');
                    }
                });
            }
            
            // --- 扫一扫功能实现 --- 
            const scanView = document.getElementById('wechat-scan-view');
            const scanVideo = document.getElementById('scan-video');
            const scanBackBtn = document.querySelector('.scan-back-btn');
            const scanSwitchBtn = document.querySelector('.scan-switch-btn');
            const scanModeBtns = document.querySelectorAll('.scan-mode-btn');
            let stream = null;
            
            // 打开扫一扫界面
            function openScanView() {
                scanView.style.display = 'flex';
                startScanCamera();
            }
            
            // 关闭扫一扫界面
            function closeScanView() {
                scanView.style.display = 'none';
                stopScanCamera();
            }
            
            // 启动摄像头
            async function startScanCamera() {
                try {
                    // 获取摄像头权限并启动视频流
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: {
                            facingMode: 'environment', // 使用后置摄像头
                            width: { ideal: 1280 },
                            height: { ideal: 720 }
                        },
                        audio: false
                    });
                    
                    // 将视频流赋值给video元素
                    scanVideo.srcObject = stream;
                    scanVideo.play();
                } catch (error) {
                    console.error('无法访问摄像头:', error);
                    alert('无法访问摄像头，请检查权限设置');
                    closeScanView();
                }
            }
            
            // 停止摄像头
            function stopScanCamera() {
                if (stream) {
                    stream.getTracks().forEach(track => {
                        track.stop();
                    });
                    stream = null;
                    scanVideo.srcObject = null;
                }
            }
            

            
            // 绑定返回按钮事件
            if (scanBackBtn) {
                scanBackBtn.addEventListener('click', closeScanView);
            }
            
            // 绑定相册按钮事件
            if (scanSwitchBtn) {
                scanSwitchBtn.addEventListener('click', () => {
                    alert('从相册选择二维码功能开发中');
                });
            }
            
            // 绑定模式切换按钮事件
            scanModeBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    // 移除所有按钮的active类
                    scanModeBtns.forEach(b => b.classList.remove('active'));
                    // 为当前按钮添加active类
                    btn.classList.add('active');
                    
                    // 切换扫描模式（实际项目中应该改变扫描逻辑）
                    const mode = btn.dataset.mode;
                    console.log('切换到', mode === 'qr' ? '二维码' : '条形码', '模式');
                });
            });
            
            // --- 微信钱包功能 --- 
            // 钱包状态
            const walletState = {
                balance: parseFloat(localStorage.getItem('wechat_wallet_balance')) || 0
            };
            
            // 保存钱包状态
            function saveWalletState() {
                localStorage.setItem('wechat_wallet_balance', walletState.balance.toString());
            }
            
            // 打开钱包界面
            function openWalletView() {
                const walletView = document.getElementById('wechat-wallet-view');
                const walletBalance = document.getElementById('wallet-balance');
                const withdrawBalance = document.getElementById('withdraw-balance');
                
                if (walletView) {
                    walletView.style.display = 'flex';
                }
                
                if (walletBalance) {
                    walletBalance.textContent = `¥${walletState.balance.toFixed(2)}`;
                }
                
                if (withdrawBalance) {
                    withdrawBalance.textContent = `¥${walletState.balance.toFixed(2)}`;
                }
            }
            
            // 关闭钱包界面
            function closeWalletView() {
                const walletView = document.getElementById('wechat-wallet-view');
                if (walletView) {
                    walletView.style.display = 'none';
                }
            }
            
            // 打开充值模态框
            function openRechargeModal() {
                const modal = document.getElementById('wallet-recharge-modal');
                if (modal) {
                    modal.classList.add('active');
                }
            }
            
            // 关闭充值模态框
            function closeRechargeModal() {
                const modal = document.getElementById('wallet-recharge-modal');
                if (modal) {
                    modal.classList.remove('active');
                    document.getElementById('recharge-amount').value = '';
                    document.querySelectorAll('.recharge-option').forEach(option => {
                        option.classList.remove('active');
                    });
                }
            }
            
            // 打开提现模态框
            function openWithdrawModal() {
                const modal = document.getElementById('wallet-withdraw-modal');
                const withdrawBalance = document.getElementById('withdraw-balance');
                if (modal) {
                    modal.classList.add('active');
                    if (withdrawBalance) {
                        withdrawBalance.textContent = `¥${walletState.balance.toFixed(2)}`;
                    }
                }
            }
            
            // 关闭提现模态框
            function closeWithdrawModal() {
                const modal = document.getElementById('wallet-withdraw-modal');
                if (modal) {
                    modal.classList.remove('active');
                    document.getElementById('withdraw-amount').value = '';
                }
            }
            
            // 充值
            function rechargeWallet() {
                const amountInput = document.getElementById('recharge-amount');
                const amount = parseFloat(amountInput.value);
                
                if (isNaN(amount) || amount <= 0) {
                    alert('请输入有效的充值金额');
                    return;
                }
                
                walletState.balance += amount;
                saveWalletState();
                updateWalletBalance();
                closeRechargeModal();
                alert(`充值成功！当前余额：¥${walletState.balance.toFixed(2)}`);
            }
            
            // 绑定切换账号相关事件
            const switchAccountBtn = document.getElementById('wechat-switch-account-btn');
            const accountView = document.getElementById('wechat-account-view');
            const accountBack = document.getElementById('wechat-account-back');
            const accountList = document.getElementById('wechat-account-list');
            const accountAdd = document.getElementById('wechat-account-add');

            const accountCancelBtn = document.getElementById('wechat-account-cancel-btn');

            if (switchAccountBtn) {
                switchAccountBtn.addEventListener('click', () => {
                    accountView.style.display = 'flex';
                    setTimeout(() => {
                        accountView.classList.add('active');
                    }, 10);
                    renderAccountList();
                });
            }

            if (accountBack) {
                accountBack.addEventListener('click', () => {
                    accountView.classList.remove('active');
                    setTimeout(() => {
                        accountView.style.display = 'none';
                    }, 400);
                });
            }

            if (accountCancelBtn) {
                accountCancelBtn.addEventListener('click', () => {
                    accountView.classList.remove('active');
                    setTimeout(() => {
                        accountView.style.display = 'none';
                    }, 400);
                });
            }

            // 点击遮罩层关闭
            if (accountView) {
                accountView.addEventListener('click', (e) => {
                    if (e.target === accountView) {
                        accountView.classList.remove('active');
                        setTimeout(() => {
                            accountView.style.display = 'none';
                        }, 400);
                    }
                });
            }

            const GREY_AVATAR = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mMsLStfDwAFXwJv6P790wAAAABJRU5ErkJggg==';

            if (accountAdd) {
                accountAdd.addEventListener('click', () => {
                    const modal = document.getElementById('wechat-add-identity-modal');
                    if (modal) {
                        // 重置表单
                        document.getElementById('add-identity-nickname').value = '';
                        document.getElementById('add-identity-wechatid').value = '';
                        document.getElementById('add-identity-persona').value = '';
                        
                        const previewImg = document.getElementById('add-identity-avatar-img');
                        previewImg.src = '';
                        previewImg.style.display = 'none';
                        
                        modal.classList.add('active');
                    }
                });
            }

            // 处理创建身份弹窗的事件
            const addIdentityModal = document.getElementById('wechat-add-identity-modal');
            const addIdentityClose = document.getElementById('wechat-add-identity-close');
            const addIdentityCancel = document.getElementById('add-identity-cancel-btn');
            const addIdentityConfirm = document.getElementById('add-identity-confirm-btn');
            const addIdentityAvatarBtn = document.getElementById('add-identity-avatar-btn');
            const addIdentityAvatarInput = document.getElementById('add-identity-avatar-input');
            const addIdentityAvatarImg = document.getElementById('add-identity-avatar-img');

            if (addIdentityClose) addIdentityClose.onclick = () => addIdentityModal.classList.remove('active');
            if (addIdentityCancel) addIdentityCancel.onclick = () => addIdentityModal.classList.remove('active');
            
            if (addIdentityAvatarBtn && addIdentityAvatarInput) {
                addIdentityAvatarBtn.onclick = () => addIdentityAvatarInput.click();
                addIdentityAvatarInput.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            addIdentityAvatarImg.src = event.target.result;
                            addIdentityAvatarImg.style.display = 'block';
                        };
                        reader.readAsDataURL(file);
                    }
                };
            }

            if (addIdentityConfirm) {
                addIdentityConfirm.onclick = async () => {
                    const nickname = document.getElementById('add-identity-nickname').value.trim();
                    const wechatid = document.getElementById('add-identity-wechatid').value.trim();
                    const persona = document.getElementById('add-identity-persona').value.trim();
                    const avatar = addIdentityAvatarImg.src;

                    if (!nickname) {
                        alert('请输入昵称');
                        return;
                    }

                    const newId = 'user_' + Date.now();
                    const newProfile = {
                        id: newId,
                        nickname: nickname,
                        wechatid: wechatid,
                        avatar: avatar,
                        persona: persona || '一个普通的用户'
                    };
                    
                    // 获取现有账号列表
                    let accounts = JSON.parse(localStorage.getItem('wechatAccounts') || '[]');
                    accounts.push(newProfile);
                    localStorage.setItem('wechatAccounts', JSON.stringify(accounts));
                    
                    addIdentityModal.classList.remove('active');
                    renderAccountList();
                    alert('新身份创建成功！');
                };
            }

            function renderAccountList() {
                if (!accountList) return;
                
                let accounts = JSON.parse(localStorage.getItem('wechatAccounts') || '[]');
                // 如果没有账号，把当前的存进去作为第一个
                if (accounts.length === 0) {
                    const currentProfile = {
                        id: 'default',
                        nickname: wechatState.profile.nickname || '我',
                        wechatid: wechatState.profile.wechatid || '',
                        avatar: wechatState.profile.avatar || GREY_AVATAR,
                        persona: wechatState.profile.persona || '一个普通的用户'
                    };
                    accounts.push(currentProfile);
                    localStorage.setItem('wechatAccounts', JSON.stringify(accounts));
                    localStorage.setItem('currentAccountId', 'default');
                }

                const currentId = localStorage.getItem('currentAccountId') || 'default';

                accountList.innerHTML = accounts.map(acc => {
                    const hasAvatar = acc.avatar && acc.avatar !== '' && acc.avatar !== GREY_AVATAR;
                    return `
                        <div class="wechat-account-item ${acc.id === currentId ? 'active' : ''}" data-id="${acc.id}">
                            <div class="account-avatar-container" style="width: 72px; height: 72px; border-radius: 50%; background-color: #f0f0f2; margin-bottom: 12px; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 3px solid #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                                ${hasAvatar ? `<img src="${acc.avatar}" style="width: 100%; height: 100%; object-fit: cover; display: block;">` : ''}
                            </div>
                            <div class="account-info">
                                <div class="account-name">${acc.nickname}</div>
                                <div class="account-status">${acc.id === currentId ? '当前使用' : '点击切换'}</div>
                            </div>
                            <div class="account-check"><i class="fas fa-check"></i></div>
                        </div>
                    `;
                }).join('');

                // 绑定切换点击
                accountList.querySelectorAll('.wechat-account-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const id = item.dataset.id;
                        if (id === currentId) return;
                        
                        const targetAcc = accounts.find(a => a.id === id);
                        if (targetAcc) {
                            // 切换逻辑
                            wechatState.profile.nickname = targetAcc.nickname;
                            wechatState.profile.avatar = targetAcc.avatar;
                            wechatState.profile.wechatid = targetAcc.wechatid || '';
                            wechatState.profile.persona = targetAcc.persona || '';
                            localStorage.setItem('currentAccountId', id);
                            
                            // 更新 UI (直接调用统一的渲染函数)
                            renderWechatProfile();

                            saveWechatData();
                            renderAccountList();
                            
                            setTimeout(() => {
                                accountView.classList.remove('active');
                                setTimeout(() => {
                                    accountView.style.display = 'none';
                                    alert(`已成功切换到账号: ${targetAcc.nickname}`);
                                }, 400);
                            }, 300);
                        }
                    });
                });
            }

            // 提现
            function withdrawWallet() {
                const amountInput = document.getElementById('withdraw-amount');
                const amount = parseFloat(amountInput.value);
                
                if (isNaN(amount) || amount <= 0) {
                    alert('请输入有效的提现金额');
                    return;
                }
                
                if (amount > walletState.balance) {
                    alert('余额不足');
                    return;
                }
                
                walletState.balance -= amount;
                saveWalletState();
                updateWalletBalance();
                closeWithdrawModal();
                alert(`提现成功！当前余额：¥${walletState.balance.toFixed(2)}`);
            }
            
            // 更新钱包余额显示
            function updateWalletBalance() {
                const walletBalance = document.getElementById('wallet-balance');
                const withdrawBalance = document.getElementById('withdraw-balance');
                
                if (walletBalance) {
                    walletBalance.textContent = `¥${walletState.balance.toFixed(2)}`;
                }
                
                if (withdrawBalance) {
                    withdrawBalance.textContent = `¥${walletState.balance.toFixed(2)}`;
                }
            }
            
            // 绑定钱包相关事件
            function bindWalletEvents() {
                // 钱包返回按钮
                const walletBackBtn = document.querySelector('.wallet-back-btn');
                if (walletBackBtn) {
                    walletBackBtn.addEventListener('click', closeWalletView);
                }
                
                // 充值按钮
                const rechargeBtn = document.getElementById('wallet-recharge-btn');
                if (rechargeBtn) {
                    rechargeBtn.addEventListener('click', openRechargeModal);
                }
                
                // 提现按钮
                const withdrawBtn = document.getElementById('wallet-withdraw-btn');
                if (withdrawBtn) {
                    withdrawBtn.addEventListener('click', openWithdrawModal);
                }
                
                // 充值金额选项
                const rechargeOptions = document.querySelectorAll('.recharge-option');
                rechargeOptions.forEach(option => {
                    option.addEventListener('click', () => {
                        // 移除所有active类
                        rechargeOptions.forEach(opt => opt.classList.remove('active'));
                        // 添加active类到当前选项
                        option.classList.add('active');
                        // 设置输入框值
                        const amount = parseFloat(option.textContent.replace('¥', ''));
                        document.getElementById('recharge-amount').value = amount;
                    });
                });
                
                // 充值确认按钮
                const rechargeConfirmBtn = document.getElementById('recharge-confirm-btn');
                if (rechargeConfirmBtn) {
                    rechargeConfirmBtn.addEventListener('click', rechargeWallet);
                }
                
                // 提现确认按钮
                const withdrawConfirmBtn = document.getElementById('withdraw-confirm-btn');
                if (withdrawConfirmBtn) {
                    withdrawConfirmBtn.addEventListener('click', withdrawWallet);
                }
                
                // 关闭充值模态框
                const rechargeCloseBtn = document.querySelector('#wallet-recharge-modal .wechat-close-btn');
                if (rechargeCloseBtn) {
                    rechargeCloseBtn.addEventListener('click', closeRechargeModal);
                }
                
                // 关闭提现模态框
                const withdrawCloseBtn = document.querySelector('#wallet-withdraw-modal .wechat-close-btn');
                if (withdrawCloseBtn) {
                    withdrawCloseBtn.addEventListener('click', closeWithdrawModal);
                }
                
                // 充值模态框取消按钮
                const rechargeCancelBtn = document.querySelector('#wallet-recharge-modal .secondary');
                if (rechargeCancelBtn) {
                    rechargeCancelBtn.addEventListener('click', closeRechargeModal);
                }
                
                // 提现模态框取消按钮
                const withdrawCancelBtn = document.querySelector('#wallet-withdraw-modal .secondary');
                if (withdrawCancelBtn) {
                    withdrawCancelBtn.addEventListener('click', closeWithdrawModal);
                }
            }
            
            // 红包功能
            function openRedpacketModal() {
                const modal = document.getElementById('wechat-redpacket-modal');
                const redpacketBalance = document.getElementById('redpacket-balance');
                const totalShow = document.getElementById('redpacket-total-show');
                if (modal) {
                    modal.classList.add('active');
                    if (redpacketBalance) {
                        redpacketBalance.textContent = `¥${walletState.balance.toFixed(2)}`;
                    }
                    if (totalShow) {
                        totalShow.textContent = '0.00';
                    }
                }
            }
            
            function closeRedpacketModal() {
                const modal = document.getElementById('wechat-redpacket-modal');
                if (modal) {
                    modal.classList.remove('active');
                    document.getElementById('redpacket-amount').value = '';
                    document.getElementById('redpacket-msg').value = '恭喜发财，大吉大利';
                    const totalShow = document.getElementById('redpacket-total-show');
                    if (totalShow) totalShow.textContent = '0.00';
                }
            }

            // 转账功能
            function openTransferModal() {
                const modal = document.getElementById('wechat-transfer-modal');
                const char = wechatState.characters.find(c => c.id == wechatState.activeCharacterId);
                if (modal && char) {
                    modal.classList.add('active');
                    document.getElementById('transfer-target-avatar').src = char.avatar;
                    document.getElementById('transfer-target-name').textContent = char.name;
                    document.getElementById('transfer-balance').textContent = `¥${walletState.balance.toFixed(2)}`;
                }
            }

            function closeTransferModal() {
                const modal = document.getElementById('wechat-transfer-modal');
                if (modal) {
                    modal.classList.remove('active');
                    document.getElementById('transfer-amount').value = '';
                    document.getElementById('transfer-remark').value = '';
                }
            }

            function sendTransfer() {
                const amountInput = document.getElementById('transfer-amount');
                const remarkInput = document.getElementById('transfer-remark');
                const amount = parseFloat(amountInput.value);
                const remark = remarkInput.value.trim();
                
                if (isNaN(amount) || amount <= 0) {
                    alert('请输入有效的转账金额');
                    return;
                }
                
                if (amount > walletState.balance) {
                    alert('余额不足');
                    return;
                }
                
                walletState.balance -= amount;
                saveWalletState();
                updateWalletBalance();
                closeTransferModal();
                
                // 添加转账消息到聊天记录
                const char = wechatState.characters.find(c => c.id == wechatState.activeCharacterId);
                if (char) {
                    const tfId = 'tf_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
                    const transferContent = `<div class="wechat-transfer" data-id="${tfId}" data-amount="${amount.toFixed(2)}" data-sender="user">
                        <div class="transfer-main">
                            <div class="transfer-icon"><i class="fas fa-exchange-alt"></i></div>
                            <div class="transfer-text">
                                <div class="transfer-amount">¥${amount.toFixed(2)}</div>
                                <div class="transfer-status">转账给${char.name}</div>
                            </div>
                        </div>
                        <div class="transfer-footer">微信支付</div>
                    </div>`;
                    addWechatMessage(transferContent, 'user', char.avatar);
                    char.chatHistory.push({ role: 'user', content: transferContent });
                    saveWechatData();

                    // 模拟对方领取转账
                    setTimeout(() => {
                        // 更新历史记录中的转账状态
                        for (let i = char.chatHistory.length - 1; i >= 0; i--) {
                            if (char.chatHistory[i].content.includes(`data-id="${tfId}"`)) {
                                let content = char.chatHistory[i].content;
                                content = content.replace('class="wechat-transfer"', 'class="wechat-transfer" data-opened="true" style="opacity: 0.7"');
                                content = content.replace(`转账给${char.name}`, '已被接收');
                                char.chatHistory[i].content = content;
                                break;
                            }
                        }

                        const systemMsg = `"${char.name}"已确认收钱`;
                        char.chatHistory.push({ role: 'system', content: systemMsg });
                        saveWechatData();

                        // 更新 UI
                        if (wechatState.activeCharacterId === char.id) {
                            const tfElements = document.querySelectorAll(`.wechat-transfer[data-id="${tfId}"]`);
                            tfElements.forEach(tf => {
                                tf.dataset.opened = 'true';
                                tf.style.opacity = '0.7';
                                const statusEl = tf.querySelector('.transfer-status');
                                if (statusEl) statusEl.textContent = '已被接收';
                            });
                            addWechatMessage(systemMsg, 'system', char.avatar);
                        }
                    }, 3000);
                }
            }

            // 监听转账金额输入
            document.getElementById('transfer-amount')?.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value) || 0;
                const sendBtn = document.getElementById('transfer-send-btn');
                if (sendBtn) {
                    sendBtn.disabled = val <= 0 || val > walletState.balance;
                }
            });

            // 监听红包金额输入，实时更新总额显示
            document.getElementById('redpacket-amount')?.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value) || 0;
                const totalShow = document.getElementById('redpacket-total-show');
                const sendBtn = document.getElementById('redpacket-send-btn');
                if (totalShow) totalShow.textContent = val.toFixed(2);
                
                // 实时校验按钮状态
                if (sendBtn) {
                    sendBtn.disabled = val <= 0 || val > walletState.balance;
                }
            });
            
            function sendRedpacket() {
                const amountInput = document.getElementById('redpacket-amount');
                const msgInput = document.getElementById('redpacket-msg');
                const amount = parseFloat(amountInput.value);
                const msg = msgInput.value.trim() || '恭喜发财，大吉大利';
                
                if (isNaN(amount) || amount <= 0) {
                    alert('请输入有效的红包金额');
                    return;
                }
                
                if (amount > walletState.balance) {
                    alert('余额不足');
                    return;
                }
                
                walletState.balance -= amount;
                saveWalletState();
                updateWalletBalance();
                closeRedpacketModal();
                
                // 添加红包消息到聊天记录
                const char = wechatState.characters.find(c => c.id == wechatState.activeCharacterId);
                if (char) {
                    const rpId = 'rp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
                    // 使用 1:1 还原的红包 HTML
                    const redpacketContent = `
                        <div class="wechat-redpacket" data-id="${rpId}" data-amount="${amount.toFixed(2)}" data-msg="${msg}" data-sender="user">
                            <div class="wechat-redpacket-top">
                                <div class="wechat-redpacket-icon"></div>
                                <div class="wechat-redpacket-info">
                                    <div class="wechat-redpacket-msg">${msg}</div>
                                    <div class="wechat-redpacket-status">已发出</div>
                                </div>
                            </div>
                            <div class="wechat-redpacket-bottom">微信红包</div>
                        </div>
                    `;
                    addWechatMessage(redpacketContent, 'user', char.avatar);
                    char.chatHistory.push({ role: 'user', content: redpacketContent });
                    saveWechatData();

                    // 模拟对方领取红包并触发AI回复
                    setTimeout(() => {
                        // 更新历史记录中的红包状态
                        for (let i = char.chatHistory.length - 1; i >= 0; i--) {
                            if (char.chatHistory[i].content.includes(`data-id="${rpId}"`)) {
                                let content = char.chatHistory[i].content;
                                content = content.replace('class="wechat-redpacket"', 'class="wechat-redpacket" data-opened="true" style="opacity: 0.7"');
                                content = content.replace('<div class="wechat-redpacket-status">已发出</div>', '<div class="wechat-redpacket-status">已领取</div>');
                                char.chatHistory[i].content = content;
                                break;
                            }
                        }

                        const systemMsg = `"${char.name}"领取了你的红包`;
                        char.chatHistory.push({ role: 'system', content: systemMsg });
                        saveWechatData();

                        // 仅当用户停留在当前聊天界面时，更新 DOM
                        if (wechatState.activeCharacterId == char.id) {
                            const rpElements = document.querySelectorAll(`.wechat-redpacket[data-id="${rpId}"]`);
                            rpElements.forEach(rp => {
                                rp.dataset.opened = 'true';
                                rp.style.opacity = '0.7';
                                const statusEl = rp.querySelector('.wechat-redpacket-status');
                                if (statusEl) statusEl.textContent = '已领取';
                            });
                            addWechatMessage(systemMsg, 'system', char.avatar);
                        }

                        // 触发AI回复
                        const fakeText = `[发来了一个微信红包] 金额: ${amount.toFixed(2)}元，留言: ${msg}`;
                        const delayTimeVal = parseInt(localStorage.getItem('wechatDelayReplyTime') || '3');
                        const isDelayEnabled = delayTimeVal > 0;
                        
                        if (isDelayEnabled) {
                            const delayTime = delayTimeVal * 1000;
                            if (!char.pendingUserMessages) char.pendingUserMessages = [];
                            char.pendingUserMessages.push(fakeText);
                            
                            if (char.delayReplyTimer) clearTimeout(char.delayReplyTimer);
                            
                            char.delayReplyTimer = setTimeout(() => {
                                const combinedMessages = [...char.pendingUserMessages];
                                char.pendingUserMessages = [];
                                char.isTyping = true;
                                if (wechatState.activeCharacterId == char.id) showWechatTyping(char);
                                processWechatAIMessage(char, combinedMessages);
                            }, delayTime);
                        } else {
                            char.isTyping = true;
                            if (wechatState.activeCharacterId == char.id) showWechatTyping(char);
                            processWechatAIMessage(char, [fakeText]);
                        }
                    }, 2000); // 发出后 2 秒被模拟领取
                }
            }

            // 处理红包点击
            function handleRedpacketClick(e) {
                const rp = e.target.closest('.wechat-redpacket');
                if (!rp) return;

                const rpId = rp.dataset.id;
                const amount = rp.dataset.amount;
                const msg = rp.dataset.msg;
                const sender = rp.dataset.sender || 'user';
                const char = wechatState.characters.find(c => c.id == wechatState.activeCharacterId);
                
                if (!char) return;
                
                const isAI = sender === 'ai';
                const senderName = isAI ? char.name : (wechatState.profile.nickname || '我');
                const senderAvatar = isAI ? char.avatar : (wechatState.profile.avatar || 'https://image-1306385190.cos.ap-nanjing.myqcloud.com/gpt/avatar_user.png');

                const openModal = document.getElementById('wechat-redpacket-open-modal');
                const openAvatar = document.getElementById('redpacket-open-avatar');
                const openName = document.getElementById('redpacket-open-name');
                const openTitle = document.querySelector('.redpacket-open-title');
                const openBtn = document.getElementById('redpacket-open-btn');
                const detailContent = document.getElementById('redpacket-detail-content');
                const openContent = document.querySelector('.redpacket-open-content');

                // 重置状态
                openBtn.onclick = null; // 先解绑之前的点击事件，防止重复触发
                openBtn.classList.remove('spinning');
                openBtn.style.display = 'flex';
                detailContent.style.display = 'none';
                openContent.style.display = 'flex';

                // 设置数据
                openAvatar.src = senderAvatar;
                openName.textContent = senderName;
                openTitle.textContent = msg;

                // 检查是否是自己发出的红包
                if (sender === 'user') {
                    // 如果是用户自己发出的红包，直接显示详情
                    openContent.style.display = 'none';
                    detailContent.style.display = 'flex';
                    const detailAvatar = document.getElementById('redpacket-detail-avatar');
                    const detailName = document.getElementById('redpacket-detail-name');
                    const detailMsg = document.getElementById('redpacket-detail-msg');
                    const detailAmount = document.getElementById('redpacket-detail-amount');
                    detailAvatar.src = senderAvatar;
                    detailName.textContent = senderName;
                    detailMsg.textContent = msg;
                    detailAmount.textContent = amount;
                    
                    // 修改提示文字，表示是自己发的红包
                    rp.dataset.opened = 'true';
                    rp.querySelector('.wechat-redpacket-status').textContent = '已发出';
                    
                    openModal.classList.add('active');
                    return;
                }

                // 检查是否已领取
                const isOpened = rp.dataset.opened === 'true';
                if (isOpened) {
                    openContent.style.display = 'none';
                    detailContent.style.display = 'flex';
                    const detailAvatar = document.getElementById('redpacket-detail-avatar');
                    const detailName = document.getElementById('redpacket-detail-name');
                    const detailMsg = document.getElementById('redpacket-detail-msg');
                    const detailAmount = document.getElementById('redpacket-detail-amount');
                    detailAvatar.src = senderAvatar;
                    detailName.textContent = senderName;
                    detailMsg.textContent = msg;
                    detailAmount.textContent = amount;
                    openModal.classList.add('active');
                    return;
                }

                // 绑定开红包事件
                openBtn.onclick = () => {
                    openBtn.classList.add('spinning');
                    setTimeout(() => {
                        // 领取逻辑
                        const detailAvatar = document.getElementById('redpacket-detail-avatar');
                        const detailName = document.getElementById('redpacket-detail-name');
                        const detailMsg = document.getElementById('redpacket-detail-msg');
                        const detailAmount = document.getElementById('redpacket-detail-amount');

                        detailAvatar.src = senderAvatar;
                        detailName.textContent = senderName;
                        detailMsg.textContent = msg;
                        detailAmount.textContent = amount;

                        openContent.style.display = 'none';
                        detailContent.style.display = 'flex';
                        
                        // 1. 更新当前页面的 DOM 状态
                        rp.dataset.opened = 'true';
                        rp.querySelector('.wechat-redpacket-status').textContent = '已领取';
                        rp.style.opacity = '0.7';

                        // 2. 核心修复：同步更新历史记录中的 HTML 内容
                        if (rpId) {
                            for (let i = char.chatHistory.length - 1; i >= 0; i--) {
                                if (char.chatHistory[i].content.includes(`data-id="${rpId}"`)) {
                                    let content = char.chatHistory[i].content;
                                    // 添加 data-opened 属性和样式
                                    if (!content.includes('data-opened="true"')) {
                                        content = content.replace('class="wechat-redpacket"', 'class="wechat-redpacket" data-opened="true" style="opacity: 0.7"');
                                        content = content.replace('<div class="wechat-redpacket-status">领取红包</div>', '<div class="wechat-redpacket-status">已领取</div>');
                                        char.chatHistory[i].content = content;
                                    }
                                    break;
                                }
                            }
                        }
                        
                        // 3. 持久化存储
                        saveWechatData();
                        
                        // 如果是AI发的红包，增加钱包余额
                        if (isAI) {
                            walletState.balance += parseFloat(amount);
                            saveWalletState();
                            updateWalletBalance();
                        }
                    }, 1200);
                };

                openModal.classList.add('active');
            }

            // 处理转账点击
            function handleTransferClick(e) {
                const tf = e.target.closest('.wechat-transfer');
                if (!tf) return;

                const tfId = tf.dataset.id;
                const amount = tf.dataset.amount;
                const sender = tf.dataset.sender || 'user';
                const char = wechatState.characters.find(c => c.id === wechatState.activeCharacterId);
                
                if (!char) return;

                // 显示转账详情模态框
                const detailModal = document.getElementById('wechat-transfer-detail-modal');
                const statusIcon = document.getElementById('transfer-detail-status-icon');
                const statusText = document.getElementById('transfer-detail-status-text');
                const amountNum = document.getElementById('transfer-detail-amount-num');
                const receiveBtn = document.getElementById('transfer-detail-receive-btn');
                const actionArea = document.getElementById('transfer-detail-action-area');
                const receiveTimeItem = document.getElementById('transfer-detail-receive-time-item');
                const timeEl = document.getElementById('transfer-detail-time');
                const receiveTimeEl = document.getElementById('transfer-detail-receive-time');

                const now = new Date();
                const timeStr = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
                
                timeEl.textContent = timeStr;
                receiveTimeEl.textContent = timeStr; // 简化处理，收钱时间也设为现在

                amountNum.textContent = parseFloat(amount).toFixed(2);
                
                // 根据状态设置 UI
                if (tf.dataset.opened === 'true') {
                    statusIcon.className = 'fas fa-check-circle';
                    statusIcon.style.color = '#07C160';
                    statusText.textContent = sender === 'user' ? '对方已收款' : '已收钱';
                    actionArea.style.display = 'none';
                    receiveTimeItem.style.display = 'flex';
                } else {
                    if (sender === 'user') {
                        statusIcon.className = 'fas fa-clock';
                        statusIcon.style.color = '#f89e24';
                        statusText.textContent = '待对方收钱';
                        actionArea.style.display = 'none';
                        receiveTimeItem.style.display = 'none';
                    } else {
                        statusIcon.className = 'fas fa-arrow-circle-down';
                        statusIcon.style.color = '#f89e24';
                        statusText.textContent = '请确认收钱';
                        actionArea.style.display = 'flex';
                        receiveTimeItem.style.display = 'none';
                        
                        // 绑定收钱按钮
                        receiveBtn.onclick = () => {
                            // 1. 更新当前页面的 DOM 状态
                            tf.dataset.opened = 'true';
                            const statusEl = tf.querySelector('.transfer-status');
                            if (statusEl) statusEl.textContent = '已收款';
                            tf.style.opacity = '0.7';

                            // 2. 持久化存储：同步更新历史记录中的 HTML 内容
                            if (tfId) {
                                for (let i = char.chatHistory.length - 1; i >= 0; i--) {
                                    if (char.chatHistory[i].content.includes(`data-id="${tfId}"`)) {
                                        let content = char.chatHistory[i].content;
                                        if (!content.includes('data-opened="true"')) {
                                            content = content.replace('class="wechat-transfer"', 'class="wechat-transfer" data-opened="true" style="opacity: 0.7"');
                                            content = content.replace('微信转账', '已收款');
                                            char.chatHistory[i].content = content;
                                        }
                                        break;
                                    }
                                }
                            }
                            
                            // 3. 增加钱包余额
                            walletState.balance += parseFloat(amount);
                            saveWalletState();
                            updateWalletBalance();
                            
                            // 4. 保存微信数据
                            saveWechatData();
                            
                            // 5. 更新详情页 UI
                            statusIcon.className = 'fas fa-check-circle';
                            statusIcon.style.color = '#07C160';
                            statusText.textContent = '已收钱';
                            actionArea.style.display = 'none';
                            receiveTimeItem.style.display = 'flex';
                            
                            alert('已成功收款，金额已存入零钱');
                        };
                    }
                }

                detailModal.classList.add('active');
            }
            
            // 绑定红包相关事件
            function bindRedpacketEvents() {
                // 红包按钮
                const redpacketBtn = document.getElementById('wechat-redpacket-btn');
                if (redpacketBtn) {
                    redpacketBtn.addEventListener('click', openRedpacketModal);
                }
                
                // 红包发送按钮
                const redpacketSendBtn = document.getElementById('redpacket-send-btn');
                if (redpacketSendBtn) {
                    redpacketSendBtn.addEventListener('click', sendRedpacket);
                }
                
                // 红包取消按钮
                const redpacketCancelBtn = document.getElementById('redpacket-cancel-btn');
                if (redpacketCancelBtn) {
                    redpacketCancelBtn.addEventListener('click', closeRedpacketModal);
                }
                
                // 关闭红包模态框
                const redpacketCloseBtn = document.querySelector('#wechat-redpacket-modal .wechat-close-btn');
                if (redpacketCloseBtn) {
                    redpacketCloseBtn.addEventListener('click', closeRedpacketModal);
                }

                // 领取红包模态框关闭
                document.getElementById('redpacket-open-close')?.addEventListener('click', () => {
                    document.getElementById('wechat-redpacket-open-modal').classList.remove('active');
                });

                // 聊天列表点击代理，处理红包和转账点击
                document.getElementById('wechat-messages')?.addEventListener('click', (e) => {
                    if (e.target.closest('.wechat-redpacket')) {
                        handleRedpacketClick(e);
                    } else if (e.target.closest('.wechat-transfer')) {
                        handleTransferClick(e);
                    }
                });

                // 转账发送按钮
                const transferSendBtn = document.getElementById('transfer-send-btn');
                if (transferSendBtn) {
                    transferSendBtn.addEventListener('click', sendTransfer);
                }
                
                // 转账取消按钮
                const transferCancelBtn = document.getElementById('transfer-cancel-btn');
                if (transferCancelBtn) {
                    transferCancelBtn.addEventListener('click', closeTransferModal);
                }

                // 转账详情关闭按钮
                const transferDetailClose = document.getElementById('transfer-detail-close');
                if (transferDetailClose) {
                    transferDetailClose.addEventListener('click', () => {
                        document.getElementById('wechat-transfer-detail-modal').classList.remove('active');
                    });
                }
            }
            
            // 绑定钱包事件
            bindWalletEvents();
            // 绑定红包事件
            bindRedpacketEvents();
            
            // 表情选择器功能
            function bindEmojiEvents() {
                const emojiBtn = document.getElementById('wechat-emoji-btn');
                const emojiPicker = document.getElementById('wechat-emoji-picker');
                const emojiItems = emojiPicker.querySelectorAll('.wechat-emoji-item');
                const input = document.getElementById('wechat-input');
                
                if (emojiBtn) {
                    emojiBtn.addEventListener('click', () => {
                        emojiPicker.classList.toggle('active');
                        document.getElementById('wechat-more-panel').classList.remove('active');
                    });
                }
                
                emojiItems.forEach(item => {
                    item.addEventListener('click', () => {
                        input.value += item.textContent;
                    });
                });
            }
            
            // 获取图片的视觉描述内容
            async function getVisionDescription(base64Image) {
                const visionApiUrl = localStorage.getItem('visionApiUrl');
                const visionApiKey = localStorage.getItem('visionApiKey');
                const visionModel = localStorage.getItem('visionApiModel') === 'custom' ? 
                                   localStorage.getItem('visionApiCustomModel') : 
                                   localStorage.getItem('visionApiModel');

                if (!visionApiUrl || !visionApiKey) {
                    return "[用户发送了一张图片]";
                }

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时

                try {
                    const response = await fetch(visionApiUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${visionApiKey}`
                        },
                        body: JSON.stringify({
                            model: visionModel || 'gpt-4o',
                            messages: [
                                {
                                    role: "user",
                                    content: [
                                        { type: "text", text: "请简要描述这张图片的内容，直接输出描述，不要有任何多余的开头。如果你觉得图片是截图或者是特定的对话内容，请说明。" },
                                        { type: "image_url", image_url: { url: base64Image } }
                                    ]
                                }
                            ],
                            max_tokens: 300
                        }),
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    if (response.ok) {
                        const data = await response.json();
                        const description = data.choices[0]?.message?.content;
                        if (description) {
                            return `[用户发送了一张图片，图片内容描述：${description}]`;
                        }
                    }
                } catch (error) {
                    clearTimeout(timeoutId);
                    if (error.name === 'AbortError') {
                        console.error('Vision API 请求超时');
                    } else {
                        console.error('图片识别失败:', error);
                    }
                }
                return "[用户发送了一张图片]";
            }

            // 修改发送图片逻辑
            async function sendWechatImage(file) {
                const chatId = wechatState.activeChatId;
                const chatType = wechatState.activeChatType;
                
                let target;
                if (chatType === 'single') {
                    target = wechatState.characters.find(c => c.id == chatId);
                } else {
                    target = (wechatState.groups || []).find(g => g.id == chatId);
                }

                if (!target) return;

                const reader = new FileReader();
                reader.onload = async (e) => {
                    const base64Image = e.target.result;
                    const imageHtml = `<div class="wechat-msg-image"><img src="${base64Image}" onclick="previewImage('${base64Image}')"></div>`;
                    
                    // 添加到界面
                    addWechatMessage(imageHtml, 'user', wechatState.profile.avatar);
                    
                    // 识别图片
                    const visionDescription = await getVisionDescription(base64Image);
                    
                    target.chatHistory.push({ 
                        role: 'user', 
                        content: imageHtml, 
                        visionDescription: visionDescription 
                    });
                    saveWechatData();

                    // 触发 AI 回复
                    if (chatType === 'single') {
                        target.isTyping = true;
                        if (wechatState.activeChatId == target.id) showWechatTyping(target);
                        processWechatAIMessage(target, [visionDescription]);
                    } else {
                        processGroupAIMessage(target, [visionDescription]);
                    }
                };
                reader.readAsDataURL(file);
            }

            // 更多功能面板
            function bindMorePanelEvents() {
                const moreBtn = document.getElementById('wechat-more-btn');
                const plusPanel = document.getElementById('wechat-plus-panel');
                
                if (moreBtn && plusPanel) {
                    moreBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const isActive = plusPanel.classList.toggle('active');
                        
                        if (isActive) {
                            const chatMessages = document.getElementById('wechat-messages');
                            setTimeout(() => {
                                chatMessages.scrollTop = chatMessages.scrollHeight;
                            }, 260);
                        }
                    });
                }
                
                // 绑定加号面板项
                document.getElementById('plus-panel-photo')?.addEventListener('click', () => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e) => {
                        const file = e.target.files[0];
                        if (file) {
                            sendWechatImage(file);
                        }
                    };
                    input.click();
                    plusPanel.classList.remove('active');
                });
                
                document.getElementById('plus-panel-camera')?.addEventListener('click', () => {
                    alert('拍照功能开发中...');
                    plusPanel.classList.remove('active');
                });
                
                document.getElementById('plus-panel-redpacket')?.addEventListener('click', () => {
                    openRedpacketModal();
                    plusPanel.classList.remove('active');
                });
                
                document.getElementById('plus-panel-transfer')?.addEventListener('click', () => {
                    openTransferModal();
                    plusPanel.classList.remove('active');
                });

                // 点击消息列表或输入框时隐藏面板
                document.getElementById('wechat-messages')?.addEventListener('click', () => {
                    plusPanel.classList.remove('active');
                });
                
                document.getElementById('wechat-input')?.addEventListener('focus', () => {
                    plusPanel.classList.remove('active');
                });
            }
            
            // 处理更多功能
            function handleMoreFunction(functionType) {
                switch(functionType) {
                    case 'camera':
                        // 点击朋友圈摄像头是发布朋友圈
                        const momentsPostModal = document.getElementById('moments-post-modal');
                        if (momentsPostModal) {
                            momentsPostModal.classList.add('active');
                        }
                        break;
                    case 'camera_old':
                        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                            // 尝试使用 getUserMedia API
                            navigator.mediaDevices.getUserMedia({ video: true })
                                .then(function(stream) {
                                    // 创建视频元素用于预览
                                    const video = document.createElement('video');
                                    video.srcObject = stream;
                                    video.autoplay = true;
                                    video.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
                                    
                                    // 创建拍照界面
                                    const cameraModal = document.createElement('div');
                                    cameraModal.style.cssText = `
                                        position: fixed;
                                        top: 0;
                                        left: 0;
                                        width: 100%;
                                        height: 100%;
                                        background: #000;
                                        z-index: 3000;
                                        display: flex;
                                        flex-direction: column;
                                    `;
                                    cameraModal.innerHTML = `
                                        <div style="flex: 1; position: relative;">
                                            <video id="camera-preview" style="width: 100%; height: 100%; object-fit: cover;"></video>
                                            <div style="position: absolute; top: 20px; left: 20px;">
                                                <button id="camera-cancel" style="padding: 10px 20px; background: rgba(255, 255, 255, 0.2); color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer;">
                                                    取消
                                                </button>
                                            </div>
                                        </div>
                                        <div style="padding: 20px; display: flex; justify-content: center;">
                                            <button id="camera-shutter" style="width: 80px; height: 80px; border-radius: 50%; background: white; border: 4px solid #333; cursor: pointer;"></button>
                                        </div>
                                    `;
                                    document.body.appendChild(cameraModal);
                                    
                                    // 绑定视频流
                                    const videoElement = document.getElementById('camera-preview');
                                    videoElement.srcObject = stream;
                                    
                                    // 绑定快门按钮事件
                                    document.getElementById('camera-shutter').addEventListener('click', () => {
                                        // 创建画布用于捕获图像
                                        const canvas = document.createElement('canvas');
                                        canvas.width = videoElement.videoWidth;
                                        canvas.height = videoElement.videoHeight;
                                        const ctx = canvas.getContext('2d');
                                        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                                        
                                        // 将画布转换为图像数据
                                        const imageData = canvas.toDataURL('image/jpeg');
                                        
                                        // 停止视频流
                                        stream.getTracks().forEach(track => track.stop());
                                        
                                        // 关闭相机界面
                                        cameraModal.remove();
                                        
                                        // 显示照片预览
                                        const previewModal = document.createElement('div');
                                        previewModal.style.cssText = `
                                            position: fixed;
                                            top: 0;
                                            left: 0;
                                            width: 100%;
                                            height: 100%;
                                            background: rgba(0, 0, 0, 0.9);
                                            z-index: 3000;
                                            display: flex;
                                            flex-direction: column;
                                            align-items: center;
                                            justify-content: center;
                                        `;
                                        previewModal.innerHTML = `
                                            <img src="${imageData}" style="max-width: 90%; max-height: 70%; object-fit: contain;">
                                            <div style="margin-top: 20px; display: flex; gap: 20px;">
                                                <button id="preview-send" style="padding: 12px 24px; background: #07C160; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">
                                                    发送
                                                </button>
                                                <button id="preview-cancel" style="padding: 12px 24px; background: rgba(255, 255, 255, 0.2); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">
                                                    取消
                                                </button>
                                            </div>
                                        `;
                                        document.body.appendChild(previewModal);
                                        
                                        // 绑定发送按钮事件
                                        document.getElementById('preview-send').addEventListener('click', () => {
                                            // 发送照片到聊天
                                            sendPhoto(imageData);
                                            previewModal.remove();
                                        });
                                        
                                        // 绑定取消按钮事件
                                        document.getElementById('preview-cancel').addEventListener('click', () => {
                                            previewModal.remove();
                                        });
                                    });
                                    
                                    // 绑定取消按钮事件
                                    document.getElementById('camera-cancel').addEventListener('click', () => {
                                        // 停止视频流
                                        stream.getTracks().forEach(track => track.stop());
                                        cameraModal.remove();
                                    });
                                })
                                .catch(function(error) {
                                    console.error('无法访问摄像头:', error);
                                    // 如果 getUserMedia 失败，回退到 input[type="file"] 方法
                                    const cameraInput = document.createElement('input');
                                    cameraInput.type = 'file';
                                    cameraInput.accept = 'image/*';
                                    cameraInput.capture = 'camera';
                                    cameraInput.style.display = 'none';
                                    document.body.appendChild(cameraInput);
                                    cameraInput.click();
                                    cameraInput.onchange = function(e) {
                                        if (e.target.files && e.target.files[0]) {
                                            // 处理拍摄的照片
                                            const file = e.target.files[0];
                                            const reader = new FileReader();
                                            reader.onload = function(event) {
                                                const imageData = event.target.result;
                                                // 显示照片预览
                                                const previewModal = document.createElement('div');
                                                previewModal.style.cssText = `
                                                    position: fixed;
                                                    top: 0;
                                                    left: 0;
                                                    width: 100%;
                                                    height: 100%;
                                                    background: rgba(0, 0, 0, 0.9);
                                                    z-index: 3000;
                                                    display: flex;
                                                    flex-direction: column;
                                                    align-items: center;
                                                    justify-content: center;
                                                `;
                                                previewModal.innerHTML = `
                                                    <img src="${imageData}" style="max-width: 90%; max-height: 70%; object-fit: contain;">
                                                    <div style="margin-top: 20px; display: flex; gap: 20px;">
                                                        <button id="preview-send" style="padding: 12px 24px; background: #07C160; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">
                                                            发送
                                                        </button>
                                                        <button id="preview-cancel" style="padding: 12px 24px; background: rgba(255, 255, 255, 0.2); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">
                                                            取消
                                                        </button>
                                                    </div>
                                                `;
                                                document.body.appendChild(previewModal);
                                                
                                                // 绑定发送按钮事件
                                                document.getElementById('preview-send').addEventListener('click', () => {
                                                    // 发送照片到聊天
                                                    sendPhoto(imageData);
                                                    previewModal.remove();
                                                });
                                                
                                                // 绑定取消按钮事件
                                                document.getElementById('preview-cancel').addEventListener('click', () => {
                                                    previewModal.remove();
                                                });
                                            };
                                            reader.readAsDataURL(file);
                                        }
                                        document.body.removeChild(cameraInput);
                                    };
                                });
                        } else {
                            // 浏览器不支持 getUserMedia，使用 input[type="file"] 方法
                            const cameraInput = document.createElement('input');
                            cameraInput.type = 'file';
                            cameraInput.accept = 'image/*';
                            cameraInput.capture = 'camera';
                            cameraInput.style.display = 'none';
                            document.body.appendChild(cameraInput);
                            cameraInput.click();
                            cameraInput.onchange = function(e) {
                                if (e.target.files && e.target.files[0]) {
                                    // 处理拍摄的照片
                                    const file = e.target.files[0];
                                    const reader = new FileReader();
                                    reader.onload = function(event) {
                                        const imageData = event.target.result;
                                        // 显示照片预览
                                        const previewModal = document.createElement('div');
                                        previewModal.style.cssText = `
                                            position: fixed;
                                            top: 0;
                                            left: 0;
                                            width: 100%;
                                            height: 100%;
                                            background: rgba(0, 0, 0, 0.9);
                                            z-index: 3000;
                                            display: flex;
                                            flex-direction: column;
                                            align-items: center;
                                            justify-content: center;
                                        `;
                                        previewModal.innerHTML = `
                                            <img src="${imageData}" style="max-width: 90%; max-height: 70%; object-fit: contain;">
                                            <div style="margin-top: 20px; display: flex; gap: 20px;">
                                                <button id="preview-send" style="padding: 12px 24px; background: #07C160; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">
                                                    发送
                                                </button>
                                                <button id="preview-cancel" style="padding: 12px 24px; background: rgba(255, 255, 255, 0.2); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">
                                                    取消
                                                </button>
                                            </div>
                                        `;
                                        document.body.appendChild(previewModal);
                                        
                                        // 绑定发送按钮事件
                                        document.getElementById('preview-send').addEventListener('click', () => {
                                            // 发送照片到聊天
                                            sendPhoto(imageData);
                                            previewModal.remove();
                                        });
                                        
                                        // 绑定取消按钮事件
                                        document.getElementById('preview-cancel').addEventListener('click', () => {
                                            previewModal.remove();
                                        });
                                    };
                                    reader.readAsDataURL(file);
                                }
                                document.body.removeChild(cameraInput);
                            };
                        }
                        break;
                    case 'album':
                        // 使用input[type="file"]从相册选择
                        const albumInput = document.createElement('input');
                        albumInput.type = 'file';
                        albumInput.accept = 'image/*';
                        albumInput.multiple = true;
                        albumInput.style.display = 'none';
                        document.body.appendChild(albumInput);
                        albumInput.click();
                        albumInput.onchange = function(e) {
                            if (e.target.files && e.target.files[0]) {
                                // 处理选择的照片
                                const file = e.target.files[0];
                                const reader = new FileReader();
                                reader.onload = function(event) {
                                    const imageData = event.target.result;
                                    // 显示照片预览
                                    const previewModal = document.createElement('div');
                                    previewModal.style.cssText = `
                                        position: fixed;
                                        top: 0;
                                        left: 0;
                                        width: 100%;
                                        height: 100%;
                                        background: rgba(0, 0, 0, 0.9);
                                        z-index: 3000;
                                        display: flex;
                                        flex-direction: column;
                                        align-items: center;
                                        justify-content: center;
                                    `;
                                    previewModal.innerHTML = `
                                        <img src="${imageData}" style="max-width: 90%; max-height: 70%; object-fit: contain;">
                                        <div style="margin-top: 20px; display: flex; gap: 20px;">
                                            <button id="preview-send" style="padding: 12px 24px; background: #07C160; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">
                                                发送
                                            </button>
                                            <button id="preview-cancel" style="padding: 12px 24px; background: rgba(255, 255, 255, 0.2); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">
                                                取消
                                            </button>
                                        </div>
                                    `;
                                    document.body.appendChild(previewModal);
                                    
                                    // 绑定发送按钮事件
                                    document.getElementById('preview-send').addEventListener('click', () => {
                                        // 发送照片到聊天
                                        sendPhoto(imageData);
                                        previewModal.remove();
                                    });
                                    
                                    // 绑定取消按钮事件
                                    document.getElementById('preview-cancel').addEventListener('click', () => {
                                        previewModal.remove();
                                    });
                                };
                                reader.readAsDataURL(file);
                            }
                            document.body.removeChild(albumInput);
                        };
                        break;
                    case 'file':
                        alert('文件功能开发中');
                        break;
                    case 'location':
                        alert('位置功能开发中');
                        break;
                    case 'voice':
                        alert('语音通话功能开发中');
                        break;
                    case 'video':
                        // 使用input[type="file"]录制视频
                        const videoInput = document.createElement('input');
                        videoInput.type = 'file';
                        videoInput.accept = 'video/*';
                        videoInput.capture = 'camcorder';
                        videoInput.style.display = 'none';
                        document.body.appendChild(videoInput);
                        videoInput.click();
                        videoInput.onchange = function(e) {
                            if (e.target.files && e.target.files[0]) {
                                alert('视频录制功能开发中');
                            }
                            document.body.removeChild(videoInput);
                        };
                        break;
                    case 'contact':
                        alert('名片功能开发中');
                        break;
                    case 'favorites':
                        alert('收藏功能开发中');
                        break;
                    default:
                        break;
                }
            }
            
            // 发送照片到聊天
            async function sendPhoto(imageData) {
                const chatId = wechatState.activeChatId;
                const chatType = wechatState.activeChatType;
                
                let target;
                if (chatType === 'single') {
                    target = wechatState.characters.find(c => c.id == chatId);
                } else {
                    target = (wechatState.groups || []).find(g => g.id == chatId);
                }

                if (!target) return;

                const photoContent = `<img src="${imageData}" style="max-width: 200px; max-height: 200px; border-radius: 8px; object-fit: cover;" onclick="previewImage('${imageData}')">`;
                addWechatMessage(photoContent, 'user', wechatState.profile.avatar);
                
                // 识别图片内容
                const visionDescription = await getVisionDescription(imageData);
                
                target.chatHistory.push({ 
                    role: 'user', 
                    content: photoContent,
                    visionDescription: visionDescription
                });
                saveWechatData();

                // 触发 AI 回复
                if (chatType === 'single') {
                    target.isTyping = true;
                    if (wechatState.activeChatId == target.id) showWechatTyping(target);
                    processWechatAIMessage(target, [visionDescription]);
                } else {
                    processGroupAIMessage(target, [visionDescription]);
                }
            }
            
            let videoCallStream = null;
            let wechatCurrentCamera = 'user';
            
            // 启动视频通话
            async function startVideoCall() {
                try {
                    videoCallStream = await navigator.mediaDevices.getUserMedia({ 
                        video: { facingMode: wechatCurrentCamera },
                        audio: true
                    });
                    const localVideo = document.getElementById('video-call-local');
                    if (!localVideo) {
                        alert('无法找到视频元素。');
                        console.error("Video Call Error: localVideo not found");
                        return;
                    }
                    localVideo.srcObject = videoCallStream;
                } catch (err) {
                    alert('无法访问摄像头或麦克风。\n错误: ' + err.message);
                    console.error("Video Call Error:", err);
                }
            }
            
            // 停止视频通话
            function stopVideoCall() {
                if (videoCallStream) {
                    videoCallStream.getTracks().forEach(track => track.stop());
                    videoCallStream = null;
                }
            }
            

            
            // 打开视频通话界面
            function openVideoCall() {
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    // 尝试使用 getUserMedia API
                    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                        .then(function(stream) {
                            videoCallStream = stream;
                            const videoCallView = document.createElement('div');
                            videoCallView.id = 'wechat-video-call';
                            videoCallView.style.cssText = `
                                position: fixed;
                                top: 0;
                                left: 0;
                                width: 100%;
                                height: 100%;
                                background: #000;
                                z-index: 3000;
                                display: flex;
                                flex-direction: column;
                            `;
                            
                            // 视频通话内容
                            videoCallView.innerHTML = `
                                <div style="flex: 1; display: flex; flex-direction: column; padding: 20px;">
                                    <div style="flex: 1; display: flex; align-items: center; justify-content: center; color: white;">
                                        <video id="video-call-local" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px;"></video>
                                    </div>
                                    <div style="margin-top: 20px; display: flex; justify-content: center; gap: 20px;">
                                        <button id="video-call-hangup" style="padding: 12px 24px; background: #ff3b30; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">
                                            <i class="fas fa-phone-slash"></i> 挂断
                                        </button>
                                        <button id="video-call-switch" style="padding: 12px 24px; background: rgba(255, 255, 255, 0.2); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">
                                            <i class="fas fa-sync-alt"></i> 切换摄像头
                                        </button>
                                    </div>
                                </div>
                            `;
                            
                            document.body.appendChild(videoCallView);
                            
                            // 绑定视频流
                            const localVideo = document.getElementById('video-call-local');
                            if (localVideo) {
                                localVideo.srcObject = videoCallStream;
                                localVideo.play();
                            }
                            
                            // 绑定挂断按钮事件
                            document.getElementById('video-call-hangup').addEventListener('click', () => {
                                // 停止视频流
                                stopVideoCall();
                                videoCallView.remove();
                            });
                            
                            // 绑定切换摄像头按钮事件
                            document.getElementById('video-call-switch').addEventListener('click', () => {
                                // 停止当前视频流
                                stopVideoCall();
                                
                                // 切换摄像头
                                wechatCurrentCamera = wechatCurrentCamera === 'user' ? 'environment' : 'user';
                                
                                // 重新获取视频流
                                navigator.mediaDevices.getUserMedia({ 
                                    video: { facingMode: wechatCurrentCamera },
                                    audio: true
                                })
                                .then(function(newStream) {
                                    videoCallStream = newStream;
                                    if (localVideo) {
                                        localVideo.srcObject = videoCallStream;
                                    }
                                })
                                .catch(function(err) {
                                    console.error('切换摄像头失败:', err);
                                    alert('切换摄像头失败: ' + err.message);
                                });
                            });
                        })
                        .catch(function(err) {
                            console.error('无法访问摄像头或麦克风:', err);
                            alert('无法访问摄像头或麦克风: ' + err.message);
                        });
                } else {
                    // 浏览器不支持 getUserMedia
                    alert('您的浏览器不支持视频通话功能');
                }
            }
            
            // 语音消息功能
            let isRecording = false;
            function bindVoiceEvents() {
                const voiceBtn = document.getElementById('wechat-voice-btn');
                if (voiceBtn) {
                    voiceBtn.addEventListener('mousedown', startVoiceRecording);
                    voiceBtn.addEventListener('mouseup', stopVoiceRecording);
                    voiceBtn.addEventListener('mouseleave', () => {
                        if (isRecording) {
                            stopVoiceRecording();
                        }
                    });
                    
                    // 触摸事件支持
                    voiceBtn.addEventListener('touchstart', startVoiceRecording, { passive: true });
                    voiceBtn.addEventListener('touchend', stopVoiceRecording, { passive: true });
                    

                }
            }
            
            function startVoiceRecording() {
                // 模拟语音录制开始
                console.log('开始录制语音');
                isRecording = true;
                // 这里可以添加实际的语音录制逻辑
            }
            
            function stopVoiceRecording() {
                // 模拟语音录制结束
                console.log('停止录制语音');
                if (isRecording) {
                    alert('语音消息功能开发中');
                }
                isRecording = false;
                // 这里可以添加实际的语音录制结束逻辑
            }
            
            // 编辑个人资料功能
            function initWechatEditProfile() {
                // 获取元素
                const profileContainer = document.querySelector('.wechat-profile');
                const editModal = document.getElementById('wechat-edit-profile-modal');
                const overlay = document.getElementById('wechat-edit-profile-overlay');
                const cancelBtn = document.getElementById('wechat-edit-profile-cancel');
                const saveBtn = document.getElementById('wechat-edit-profile-save');
                const editAvatar = document.getElementById('wechat-edit-avatar');
                const editAvatarInput = document.getElementById('wechat-edit-avatar-input');
                const editAvatarImg = document.getElementById('wechat-edit-avatar-img');
                const editAvatarIcon = document.getElementById('wechat-edit-avatar-icon');
                const editNickname = document.getElementById('wechat-edit-nickname');
                const editWechatid = document.getElementById('wechat-edit-wechatid');
                const editPersona = document.getElementById('wechat-edit-persona');
                
                const profileName = document.querySelector('.wechat-profile-name');
                const profileDesc = document.querySelector('.wechat-profile-desc');
                
                // 点击个人资料区域打开编辑模态框
                if (profileContainer) {
                    profileContainer.addEventListener('click', (e) => {
                        // 检查是否点击了头像上传区域
                        const avatarContainer = document.getElementById('wechat-avatar-container');
                        if (e.target.closest('#wechat-avatar-container')) {
                            // 处理头像上传，这里不打开编辑模态框
                            return;
                        }
                        
                        // 打开编辑模态框
                        editModal.style.display = 'flex';
                        
                        // 从wechatState填充表单数据
                        editNickname.value = wechatState.profile.nickname || '';
                        editWechatid.value = wechatState.profile.wechatid || '';
                        if (editPersona) editPersona.value = wechatState.profile.persona || '';
                        
                        // 初始化头像
                        if (wechatState.profile.avatar) {
                            editAvatarImg.src = wechatState.profile.avatar;
                            editAvatarImg.style.display = 'block';
                            if (editAvatarIcon) editAvatarIcon.style.display = 'none';
                        } else {
                            editAvatarImg.src = GREY_AVATAR;
                            editAvatarImg.style.display = 'block';
                            if (editAvatarIcon) editAvatarIcon.style.display = 'none';
                        }
                        
                        // 重置头像更新标志
                        delete editAvatarImg.dataset.updated;
                    });
                }
                
                // 关闭模态框
                function closeEditModal() {
                    editModal.style.display = 'none';
                }
                
                // 点击遮罩层关闭模态框
                if (overlay) {
                    overlay.addEventListener('click', closeEditModal);
                }
                
                // 点击取消按钮关闭模态框
                if (cancelBtn) {
                    cancelBtn.addEventListener('click', closeEditModal);
                }
                
                // 头像编辑功能
                if (editAvatar) {
                    editAvatar.addEventListener('click', () => {
                        editAvatarInput.click();
                    });
                }
                
                // 头像上传处理
                if (editAvatarInput) {
                    editAvatarInput.addEventListener('change', (e) => {
                        const file = e.target.files[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                                const imageUrl = event.target.result;
                                editAvatarImg.src = imageUrl;
                                editAvatarImg.style.display = 'block';
                                editAvatarIcon.style.display = 'none';
                                // 标记头像已更新
                                editAvatarImg.dataset.updated = 'true';
                            };
                            reader.readAsDataURL(file);
                        }
                    });
                }
                
                // 保存修改
                if (saveBtn) {
                    saveBtn.addEventListener('click', () => {
                        // 获取表单数据
                        const newNickname = editNickname.value.trim();
                        const newWechatid = editWechatid.value.trim();
                        
                        // 验证数据
                        if (!newNickname) {
                            alert('请输入昵称');
                            return;
                        }
                        
                        if (!newWechatid) {
                            alert('请输入微信号');
                            return;
                        }

                        // 验证微信号格式：只能包含字母、数字和下划线，长度6-20位
                        const wechatidRegex = /^[a-zA-Z0-9_]{6,20}$/;
                        if (!wechatidRegex.test(newWechatid)) {
                            alert('微信号只能包含字母、数字和下划线，长度为6-20位');
                            return;
                        }
                        
                        // 更新wechatState中的个人资料
                        wechatState.profile.nickname = newNickname;
                        wechatState.profile.wechatid = newWechatid;
                        if (editPersona) wechatState.profile.persona = editPersona.value.trim();
                        
                        // 保存头像，检查src是否有值而不是检查display属性
                        if (editAvatarImg.src && editAvatarImg.src !== '') {
                            wechatState.profile.avatar = editAvatarImg.src;
                        } else {
                            wechatState.profile.avatar = '';
                        }
                        
                        // 保存到localStorage
                        saveWechatData();
                        
                        // 同步更新切换账号列表中的数据
                        const currentId = localStorage.getItem('currentAccountId') || 'default';
                        let accounts = JSON.parse(localStorage.getItem('wechatAccounts') || '[]');
                        const accIndex = accounts.findIndex(a => a.id === currentId);
                        if (accIndex !== -1) {
                            accounts[accIndex].nickname = wechatState.profile.nickname;
                            accounts[accIndex].avatar = wechatState.profile.avatar;
                            accounts[accIndex].wechatid = wechatState.profile.wechatid;
                            accounts[accIndex].persona = wechatState.profile.persona;
                            localStorage.setItem('wechatAccounts', JSON.stringify(accounts));
                        }
                        
                        // 渲染到页面
                        renderWechatProfile();
                        
                        // 关闭模态框
                        closeEditModal();
                        
                        // 显示保存成功提示
                        alert('个人资料已保存');
                    });
                }
            }
            
            // 点击聊天区域关闭面板
            function bindChatAreaEvents() {
                const messageList = document.getElementById('wechat-messages');
                if (messageList) {
                    messageList.addEventListener('click', () => {
                        document.getElementById('wechat-emoji-picker').classList.remove('active');
                        document.getElementById('wechat-more-panel').classList.remove('active');
                    });
                }
            }
            
            // 绑定所有聊天功能事件
            bindEmojiEvents();
            bindMorePanelEvents();
            bindVoiceEvents();
            bindChatAreaEvents();
            
            // 头像上传功能
            function bindAvatarEvents() {
                const avatarContainer = document.getElementById('wechat-avatar-container');
                const avatarInput = document.getElementById('wechat-avatar-input');
                
                if (avatarContainer) {
                    avatarContainer.addEventListener('click', () => {
                        console.log('头像被点击，打开文件选择器');
                        avatarInput.click();
                    });
                }
                
                if (avatarInput) {
                    avatarInput.addEventListener('change', (e) => {
                        const file = e.target.files[0];
                        if (file) {
                            // 直接从本地文件读取，不使用URL编辑
                            const reader = new FileReader();
                            reader.onload = (event) => {
                                const localImageData = event.target.result;

                                // 更新wechatState并保存到IndexedDB
                                wechatState.profile.avatar = localImageData;
                                saveWechatData();
                                renderWechatProfile();
                                renderWechatMoments();
                            };
                            reader.readAsDataURL(file);
                        }
                    });
                }
            }
            
            // 绑定头像事件
            bindAvatarEvents();
            
            // --- 微信个人中心功能 --- 
            
            // --- 角色记忆管理功能 ---
            // --- 角色记忆管理功能 (升级版) ---
            let activeMemoryCharId = null;

            window.renderMemoryManager = async function() {
                const charListContainer = document.getElementById('memory-char-list');
                const mainView = document.getElementById('memory-main-view');
                const detailView = document.getElementById('memory-detail-view');
                const backBtn = document.getElementById('memory-manager-back-btn');
                const title = document.getElementById('memory-manager-title');

                if (!charListContainer) return;

                // 初始显示列表页
                mainView.style.display = 'block';
                detailView.style.display = 'none';
                title.textContent = '角色记忆';
                backBtn.onclick = closeApps;

                charListContainer.innerHTML = '<div style="text-align:center;padding:20px;color:#8e8e93;">加载中...</div>';

                // 确保微信数据已加载
                if (!wechatState.characters || wechatState.characters.length === 0) {
                    await loadWechatData();
                }

                const chars = wechatState.characters;
                if (!chars || chars.length === 0) {
                    charListContainer.innerHTML = '<div class="memory-empty">未发现任何角色</div>';
                    return;
                }

                charListContainer.innerHTML = chars.map(char => `
                    <div class="memory-char-card" data-id="${char.id}" style="cursor: pointer;">
                        <div class="memory-char-card-info" style="pointer-events: none;">
                            <img src="${char.avatar}" class="memory-char-card-avatar">
                            <span class="memory-char-card-name">${char.name}</span>
                        </div>
                        <span class="memory-char-card-count" style="pointer-events: none;">${(char.memories || []).length} 条</span>
                    </div>
                `).join('');

                // 采用 addEventListener 代替内联 onclick，确保即便在 0 条记忆时也能稳定进入
                charListContainer.querySelectorAll('.memory-char-card').forEach(card => {
                    card.addEventListener('click', function() {
                        const charId = this.dataset.id;
                        console.log('正在进入角色记忆详情, ID:', charId);
                        openMemoryDetail(charId);
                    });
                });
            };

            window.openMemoryDetail = function(charId) {
                activeMemoryCharId = charId;
                const char = wechatState.characters.find(c => c.id == charId);
                if (!char) {
                    console.error('未找到角色:', charId);
                    return;
                }

                const mainView = document.getElementById('memory-main-view');
                const detailView = document.getElementById('memory-detail-view');
                const backBtn = document.getElementById('memory-manager-back-btn');
                const title = document.getElementById('memory-manager-title');

                mainView.style.display = 'none';
                detailView.style.display = 'block';
                title.textContent = `${char.name} 的记忆`;
                
                // 返回列表页
                backBtn.onclick = renderMemoryManager;

                renderMemoryDetailList(char);
            };

            function renderMemoryDetailList(char) {
                const listContainer = document.getElementById('memory-detail-list');
                if (!listContainer) return;

                // 确保 memories 始终是一个数组
                if (!char.memories) char.memories = [];

                const memories = char.memories;
                if (memories.length === 0) {
                    listContainer.innerHTML = `
                        <div class="memory-empty" style="background: #fff; border-radius: 12px; padding: 30px 20px; border: 1px dashed #ddd;">
                            <div style="font-size: 24px; font-weight: bold; margin-bottom: 15px; opacity: 0.8; letter-spacing: 2px; color: #007AFF;">M͓̽e͓̽m͓̽o͓̽r͓̽y͓̽</div>
                            暂无长期记忆<br>
                            <span style="font-size: 12px; opacity: 0.7; margin-top: 8px; display: block;">您可以在上方手动输入，或等待 AI 在对话中自动生成。</span>
                        </div>
                    `;
                    return;
                }

                listContainer.innerHTML = memories.map((m, index) => `
                    <div class="memory-item">
                        <div class="memory-text">${m}</div>
                        <div class="memory-actions">
                            <button class="memory-btn memory-btn-edit" onclick="editCharacterMemory('${char.id}', ${index})">编辑</button>
                            <button class="memory-btn memory-btn-delete" onclick="deleteCharacterMemory('${char.id}', ${index})">删除</button>
                        </div>
                    </div>
                `).reverse().join(''); // 最新的记忆在上面
            }

            // 手动保存记忆
            document.getElementById('save-manual-memory-btn')?.addEventListener('click', async () => {
                if (!activeMemoryCharId) return;
                
                const input = document.getElementById('manual-memory-input');
                const text = input.value.trim();
                
                if (!text) {
                    alert('请输入记忆内容');
                    return;
                }

                const char = wechatState.characters.find(c => c.id == activeMemoryCharId);
                if (!char) return;

                if (!char.memories) char.memories = [];
                char.memories.push(text);
                
                await saveWechatData();
                input.value = '';
                renderMemoryDetailList(char);
                alert('记忆已存入');
            });

            window.editCharacterMemory = async function(charId, memoryIndex) {
                const char = wechatState.characters.find(c => c.id == charId);
                if (!char || !char.memories) return;

                const currentText = char.memories[memoryIndex];
                const newText = prompt('编辑记忆内容:', currentText);

                if (newText !== null && newText.trim() !== '' && newText !== currentText) {
                    char.memories[memoryIndex] = newText.trim();
                    await saveWechatData();
                    renderMemoryDetailList(char);
                }
            };

            window.deleteCharacterMemory = async function(charId, memoryIndex) {
                if (!confirm('确定要删除这段记忆吗？')) return;

                const char = wechatState.characters.find(c => c.id == charId);
                if (!char || !char.memories) return;

                char.memories.splice(memoryIndex, 1);
                await saveWechatData();
                renderMemoryDetailList(char);
            };
            
            // 为菜单项添加点击事件
            document.addEventListener('click', (e) => {
                // 处理菜单项点击
                const menuItem = e.target.closest('.wechat-menu-item');
                if (menuItem) {
                    const menuText = menuItem.querySelector('.wechat-menu-text').textContent;
                    
                    switch(menuText) {
                        case '钱包':
                            openWalletView();
                            break;
                        case '收藏':
                            alert('收藏功能开发中');
                            break;
                        case '朋友圈':
                            // 切换到朋友圈标签页
                            const momentsNavItem = document.querySelector('.wechat-nav-item[data-tab="moments"]');
                            if (momentsNavItem) {
                                momentsNavItem.click();
                            }
                            break;
                        case '公众号':
                            alert('公众号功能开发中');
                            break;
                        case '订单与卡包':
                            alert('订单与卡包功能开发中');
                            break;
                        case '表情':
                            alert('表情功能开发中');
                            break;
                        // 设置功能由另一个事件监听器处理
                        default:
                            break;
                    }
                }
                
                // 处理状态点击
                const statusItem = e.target.closest('.status-item');
                if (statusItem) {
                    alert('设置状态功能开发中');
                }
                
                // 处理好友请求点击
                const statusFriends = e.target.closest('.status-friends');
                if (statusFriends) {
                    alert('好友请求功能开发中');
                }
                

            });

            // --- 初始化 ---
            initDB();
            loadSettings();
            getRealWeather();
            weatherRetryBtn.addEventListener('click', getRealWeather);
            loadWallpapers();
            loadSavedWallpaper();
            loadSavedWidgetBg();
            loadCustomWallpaperPreview();
            loadWidgetBgPreview();
            initCustomIcons();
            loadIconCustomization();
            initThemeTabs();
            initCustomCSS();
            
            // 异步初始化微信
            (async () => {
                try {
                    await initWechat();
                    console.log('微信初始化成功');
                } catch (error) {
                    console.error('微信初始化失败:', error);
                    // 微信初始化失败不影响其他功能
                }
            })();
            
            initMusic();
            initGestureControls();
        });

        // --- 音乐播放器系统 ---
        function initMusic() {
            let musicState = {
                playlist: [],
                currentIndex: -1,
                isPlaying: false
            };

            const audio = document.getElementById('music-audio');
            const fileInput = document.getElementById('music-file-input');
            const importBtn = document.getElementById('music-import-btn');
            const playPauseBtn = document.getElementById('music-play-pause');
            const prevBtn = document.getElementById('music-prev');
            const nextBtn = document.getElementById('music-next');
            const showListBtn = document.getElementById('music-show-list');
            const closeListBtn = document.getElementById('music-close-list');
            const listDrawer = document.getElementById('music-list-drawer');
            const songList = document.getElementById('music-song-list');
            const progressBar = document.getElementById('music-progress-bar');
            const progressFill = document.getElementById('music-progress-fill');
            const currentTimeEl = document.getElementById('music-current-time');
            const totalTimeEl = document.getElementById('music-total-time');
            const songTitleEl = document.getElementById('music-song-title');
            const songArtistEl = document.getElementById('music-song-artist');
            const albumArtEl = document.getElementById('music-album-art');
            const musicContainer = document.querySelector('.music-container');
            
            // 控制中心元素
            const ccMusicTitle = document.getElementById('cc-music-title');
            const ccMusicArtist = document.getElementById('cc-music-artist');
            const ccMusicPlayPause = document.getElementById('cc-music-play-pause');
            const ccMusicPlayIcon = document.getElementById('cc-music-play-icon');
            const ccMusicModule = document.getElementById('cc-music-module');

            // 从数据库加载保存的音乐
            async function loadSavedMusic() {
                try {
                    const savedData = await loadDataFromIndexedDB(STORES.MUSIC, 'playlist');
                    if (savedData && savedData.songs) {
                        musicState.playlist = savedData.songs.map(song => {
                            // 恢复URL
                            song.url = URL.createObjectURL(song.file);
                            return song;
                        });
                        updatePlaylistUI();
                        if (musicState.playlist.length > 0) {
                            loadSong(0);
                        }
                    }
                } catch (error) {
                    console.error('加载保存的音乐失败:', error);
                }
            }

            // 保存音乐到数据库
            async function saveMusicToDB() {
                try {
                    // 只保存必要信息和File对象
                    const songsToSave = musicState.playlist.map(song => ({
                        id: song.id,
                        title: song.title,
                        artist: song.artist,
                        file: song.file
                    }));
                    await saveDataToIndexedDB(STORES.MUSIC, { songs: songsToSave }, 'playlist');
                } catch (error) {
                    console.error('保存音乐失败:', error);
                }
            }

            // 导入音乐
            importBtn.addEventListener('click', () => fileInput.click());

            fileInput.addEventListener('change', async (e) => {
                const files = Array.from(e.target.files);
                for (const file of files) {
                    const song = {
                        id: Date.now() + Math.random(),
                        title: file.name.replace(/\.[^/.]+$/, ""),
                        artist: '本地歌曲',
                        file: file,
                        url: URL.createObjectURL(file)
                    };
                    musicState.playlist.push(song);
                }
                updatePlaylistUI();
                await saveMusicToDB(); // 保存到数据库
                if (musicState.currentIndex === -1 && musicState.playlist.length > 0) {
                    loadSong(0);
                }
            });

            // 点击容器空白区域缩回播放列表
            musicContainer.addEventListener('click', (e) => {
                // 如果点击的不是列表抽屉内部，且列表已打开，则缩回
                if (!e.target.closest('.music-list-drawer') && 
                    !e.target.closest('#music-show-list') &&
                    listDrawer.classList.contains('active')) {
                    listDrawer.classList.remove('active');
                }
            });

            function loadSong(index) {
                if (index < 0 || index >= musicState.playlist.length) return;
                
                musicState.currentIndex = index;
                const song = musicState.playlist[index];
                
                audio.src = song.url;
                songTitleEl.textContent = song.title;
                songArtistEl.textContent = song.artist;
                
                // 同步更新控制中心
                if (ccMusicTitle) ccMusicTitle.textContent = song.title;
                if (ccMusicArtist) ccMusicArtist.textContent = song.artist;
                
                // 重置进度
                progressFill.style.width = '0%';
                currentTimeEl.textContent = '00:00';
                
                updatePlaylistUI();
                
                if (musicState.isPlaying) {
                    audio.play();
                }
            }

            // 播放/暂停
            playPauseBtn.addEventListener('click', () => {
                if (musicState.currentIndex === -1) return;
                
                if (musicState.isPlaying) {
                    audio.pause();
                } else {
                    audio.play();
                }
                musicState.isPlaying = !musicState.isPlaying;
                updatePlayPauseUI();
            });

            function updatePlayPauseUI() {
                const icon = playPauseBtn.querySelector('i');
                icon.className = musicState.isPlaying ? 'fas fa-pause' : 'fas fa-play';
                
                // 同步更新控制中心图标
                if (ccMusicPlayIcon) {
                    ccMusicPlayIcon.className = musicState.isPlaying ? 'fas fa-pause' : 'fas fa-play';
                }
            }

            // 切歌
            prevBtn.addEventListener('click', () => {
                if (musicState.playlist.length === 0) return;
                let newIndex = musicState.currentIndex - 1;
                if (newIndex < 0) newIndex = musicState.playlist.length - 1;
                loadSong(newIndex);
            });

            nextBtn.addEventListener('click', () => {
                if (musicState.playlist.length === 0) return;
                let newIndex = (musicState.currentIndex + 1) % musicState.playlist.length;
                loadSong(newIndex);
            });

            // 进度条
            audio.addEventListener('timeupdate', () => {
                if (audio.duration) {
                    const percent = (audio.currentTime / audio.duration) * 100;
                    progressFill.style.width = `${percent}%`;
                    currentTimeEl.textContent = formatTime(audio.currentTime);
                }
            });

            audio.addEventListener('loadedmetadata', () => {
                totalTimeEl.textContent = formatTime(audio.duration);
            });

            progressBar.addEventListener('click', (e) => {
                if (audio.duration) {
                    const rect = progressBar.getBoundingClientRect();
                    const pos = (e.clientX - rect.left) / rect.width;
                    audio.currentTime = pos * audio.duration;
                }
            });

            audio.addEventListener('ended', () => {
                nextBtn.click();
            });

            // 列表显示/隐藏
            showListBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                listDrawer.classList.add('active');
            });
            
            closeListBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                listDrawer.classList.remove('active');
            });

            // 点击列表内部也关闭列表
            listDrawer.addEventListener('click', (e) => {
                if (e.target === listDrawer) {
                    listDrawer.classList.remove('active');
                }
            });

            function updatePlaylistUI() {
                songList.innerHTML = '';
                musicState.playlist.forEach((song, index) => {
                    const item = document.createElement('div');
                    item.className = `song-item ${index === musicState.currentIndex ? 'active' : ''}`;
                    item.innerHTML = `
                        <div class="song-item-info">
                            <div class="song-item-title">${song.title}</div>
                            <div class="song-item-artist">${song.artist}</div>
                        </div>
                        <div class="song-item-delete" title="从库中移除">
                            <i class="fas fa-trash-alt"></i>
                        </div>
                    `;
                    
                    // 点击歌曲信息播放
                    item.querySelector('.song-item-info').addEventListener('click', (e) => {
                        e.stopPropagation();
                        loadSong(index);
                        if (!musicState.isPlaying) {
                            playPauseBtn.click();
                        }
                        listDrawer.classList.remove('active');
                    });

                    // 点击删除按钮移除歌曲
                    item.querySelector('.song-item-delete').addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const songToRemove = musicState.playlist[index];
                        
                        // 如果正在播放这首歌，先停止
                        if (index === musicState.currentIndex) {
                            audio.pause();
                            musicState.isPlaying = false;
                            updatePlayPauseUI();
                            songTitleEl.textContent = 'Silence';
                            songArtistEl.textContent = 'Waiting for melody';
                            musicState.currentIndex = -1;
                        }

                        // 从数组中移除
                        musicState.playlist.splice(index, 1);
                        
                        // 修正当前索引
                        if (musicState.currentIndex > index) {
                            musicState.currentIndex--;
                        }

                        // 更新UI并保存到数据库
                        updatePlaylistUI();
                        await saveMusicToDB();
                        
                        // 释放URL资源
                        URL.revokeObjectURL(songToRemove.url);
                    });

                    songList.appendChild(item);
                });
            }

            function formatTime(seconds) {
                if (isNaN(seconds)) return '00:00';
                const mins = Math.floor(seconds / 60);
                const secs = Math.floor(seconds % 60);
                return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            }

            // 初始化加载保存的音乐
            loadSavedMusic();

            // 控制中心交互同步
            if (ccMusicPlayPause) {
                ccMusicPlayPause.addEventListener('click', (e) => {
                    e.stopPropagation();
                    playPauseBtn.click();
                });
            }

            if (ccMusicModule) {
                ccMusicModule.addEventListener('click', (e) => {
                    // 如果点击的是播放按钮，不要打开APP
                    if (e.target.closest('#cc-music-play-pause')) return;
                    
                    openApp('music');
                    // 关闭控制中心
                    const cc = document.getElementById('control-center');
                    if (cc) cc.classList.remove('active');
                });
            }
        }

        // --- 时钟应用逻辑 ---
        let timerInterval = null;
        let timerSeconds = 0;
        let timerRunning = false;
        let activeClockTab = 'world';

        function switchClockTab(tab) {
            activeClockTab = tab;
            const contents = document.querySelectorAll('.clock-content');
            const tabs = document.querySelectorAll('.clock-tab');
            const title = document.getElementById('clock-title');
            
            contents.forEach(c => {
                c.style.display = 'none';
                c.classList.remove('active');
            });
            tabs.forEach(t => t.classList.remove('active'));
            
            const target = document.getElementById(`clock-${tab}`);
            target.style.display = 'block';
            target.classList.add('active');
            
            // 更新标题和激活状态
            if (tab === 'world') {
                title.textContent = '世界时钟';
                tabs[0].classList.add('active');
                renderWorldClocks();
                startWorldClock();
            } else if (tab === 'alarm') {
                title.textContent = '闹钟';
                tabs[1].classList.add('active');
                renderAlarms();
                stopWorldClock();
            } else if (tab === 'timer') {
                title.textContent = '计时器';
                tabs[2].classList.add('active');
                stopWorldClock();
            }
        }

        // --- 数据管理 ---
        const DEFAULT_CLOCKS = [
            { id: 'beijing', city: '北京', tz: 'Asia/Shanghai', offset: '今天，+0小时' },
            { id: 'newyork', city: '纽约', tz: 'America/New_York', offset: '今天，-15小时' },
            { id: 'london', city: '伦敦', tz: 'Europe/London', offset: '今天，-8小时' }
        ];

        const DEFAULT_ALARMS = [
            { id: 'alarm_1', time: '07:00', label: '闹钟，每天', enabled: true },
            { id: 'alarm_2', time: '08:30', label: '闹钟', enabled: false }
        ];

        function getClockData() {
            const data = localStorage.getItem('ios-clocks');
            return data ? JSON.parse(data) : DEFAULT_CLOCKS;
        }

        function getAlarmData() {
            const data = localStorage.getItem('ios-alarms');
            return data ? JSON.parse(data) : DEFAULT_ALARMS;
        }

        // --- 渲染逻辑 ---
        function renderWorldClocks() {
            const container = document.getElementById('world-clock-items');
            const clocks = getClockData();
            const now = new Date();

            let html = `
                <div class="world-clock-item" id="local-clock-item">
                    <div class="world-clock-info">
                        <div class="world-clock-city" id="local-clock-city">当前位置</div>
                        <div class="world-clock-offset" id="local-clock-offset">今天，+0小时</div>
                    </div>
                    <div class="world-clock-time" id="local-clock-time">${now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                </div>
            `;

            clocks.forEach(clk => {
                const timeStr = now.toLocaleTimeString('zh-CN', {
                    timeZone: clk.tz,
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });
                html += `
                    <div class="world-clock-item" oncontextmenu="deleteClockItem('${clk.id}', event)">
                        <div class="world-clock-info">
                            <div class="world-clock-city">${clk.city}</div>
                            <div class="world-clock-offset">${clk.offset || '今天'}</div>
                        </div>
                        <div class="world-clock-time" data-tz="${clk.tz}">${timeStr}</div>
                    </div>
                `;
            });
            container.innerHTML = html;
            fetchLocalCityForClock();
        }

        function renderAlarms() {
            const container = document.getElementById('alarm-items');
            const alarms = getAlarmData();

            container.innerHTML = alarms.map(alarm => `
                <div class="alarm-item ${alarm.enabled ? '' : 'disabled'}" oncontextmenu="deleteAlarmItem('${alarm.id}', event)">
                    <div class="alarm-info">
                        <div class="alarm-label">${alarm.label}</div>
                        <div class="alarm-time-main">${alarm.time}</div>
                    </div>
                    <label class="ios-switch">
                        <input type="checkbox" ${alarm.enabled ? 'checked' : ''} onchange="toggleAlarm('${alarm.id}', this.checked)">
                        <span class="ios-slider"></span>
                    </label>
                </div>
            `).join('');
        }

        // --- 弹出层逻辑 ---
        window.openClockAddModal = function() {
            const modal = document.getElementById('clock-add-modal');
            const title = document.getElementById('clock-modal-title');
            const formCity = document.getElementById('form-city-items');
            const formAlarmItems = document.getElementById('form-alarm-items');
            const formAlarmTime = document.getElementById('form-add-alarm-time');

            if (activeClockTab === 'world') {
                title.textContent = '添加城市';
                formCity.style.display = 'block';
                formAlarmItems.style.display = 'none';
                formAlarmTime.style.display = 'none';
            } else if (activeClockTab === 'alarm') {
                title.textContent = '添加闹钟';
                formCity.style.display = 'none';
                formAlarmItems.style.display = 'block';
                formAlarmTime.style.display = 'flex';
                
                // 初始化滚轮
                initTimeWheels();
            } else {
                return; // 计时器页不弹出
            }

            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
        };

        // 初始化滚轮
        function initTimeWheels() {
            const hourWheel = document.getElementById('wheel-hour');
            const minuteWheel = document.getElementById('wheel-minute');
            const now = new Date();
            const currentH = now.getHours();
            const currentM = now.getMinutes();

            // 生成小时选项
            let hourHtml = '';
            for (let i = 0; i < 24; i++) {
                hourHtml += `<div class="wheel-item" data-value="${i}">${String(i).padStart(2, '0')}</div>`;
            }
            hourWheel.innerHTML = hourHtml;

            // 生成分钟选项
            let minuteHtml = '';
            for (let i = 0; i < 60; i++) {
                minuteHtml += `<div class="wheel-item" data-value="${i}">${String(i).padStart(2, '0')}</div>`;
            }
            minuteWheel.innerHTML = minuteHtml;

            // 滚动到当前时间
            setTimeout(() => {
                scrollToValue(hourWheel, currentH);
                scrollToValue(minuteWheel, currentM);
                updateAlarmTimeValue();
            }, 50);

            // 监听滚动事件
            [hourWheel, minuteWheel].forEach(wheel => {
                // 实时监听滚动，更新高亮效果，增强反馈感
                wheel.addEventListener('scroll', () => {
                    updateActiveItem(wheel);
                }, { passive: true });

                // 滚动停止后更新最终数值
                wheel.addEventListener('scroll', debounce(() => {
                    updateActiveItem(wheel);
                    updateAlarmTimeValue();
                }, 100));

                // 点击项自动滚动到中心
                wheel.addEventListener('click', (e) => {
                    const item = e.target.closest('.wheel-item');
                    if (item) {
                        const val = item.dataset.value;
                        scrollToValue(wheel, val);
                    }
                });
            });
        }

        function scrollToValue(wheel, value) {
            const item = wheel.querySelector(`.wheel-item[data-value="${value}"]`);
            if (item) {
                wheel.scrollTop = item.offsetTop - 78; // 78 is padding-top
                updateActiveItem(wheel);
            }
        }

        function updateActiveItem(wheel) {
            const items = wheel.querySelectorAll('.wheel-item');
            const index = Math.round(wheel.scrollTop / 44);
            
            items.forEach((item, i) => {
                if (i === index) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });
        }

        function updateAlarmTimeValue() {
            const activeHour = document.querySelector('#wheel-hour .wheel-item.active');
            const activeMinute = document.querySelector('#wheel-minute .wheel-item.active');
            
            if (activeHour && activeMinute) {
                const h = String(activeHour.dataset.value).padStart(2, '0');
                const m = String(activeMinute.dataset.value).padStart(2, '0');
                document.getElementById('input-alarm-time').value = `${h}:${m}`;
            }
        }

        function debounce(func, wait) {
            let timeout;
            return function() {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, arguments), wait);
            };
        }

        window.closeClockAddModal = function() {
            const modal = document.getElementById('clock-add-modal');
            modal.classList.remove('active');
            setTimeout(() => modal.style.display = 'none', 300);
        };

        window.saveClockItem = function() {
            if (activeClockTab === 'world') {
                const name = document.getElementById('input-city-name').value.trim();
                const tz = document.getElementById('input-city-tz').value;
                if (!name) return alert('请输入城市名称');

                const clocks = getClockData();
                clocks.push({
                    id: 'clk_' + Date.now(),
                    city: name,
                    tz: tz,
                    offset: '今天'
                });
                localStorage.setItem('ios-clocks', JSON.stringify(clocks));
                renderWorldClocks();
            } else {
                const time = document.getElementById('input-alarm-time').value;
                const label = document.getElementById('input-alarm-label').value.trim() || '闹钟';

                const alarms = getAlarmData();
                alarms.push({
                    id: 'alm_' + Date.now(),
                    time: time,
                    label: label,
                    enabled: true
                });
                localStorage.setItem('ios-alarms', JSON.stringify(alarms));
                renderAlarms();
            }
            closeClockAddModal();
        };

        window.toggleAlarm = function(id, enabled) {
            const alarms = getAlarmData();
            const idx = alarms.findIndex(a => a.id === id);
            if (idx > -1) {
                alarms[idx].enabled = enabled;
                localStorage.setItem('ios-alarms', JSON.stringify(alarms));
                renderAlarms();
            }
        };

        window.deleteClockItem = function(id, e) {
            e.preventDefault();
            if (confirm('删除此城市？')) {
                const clocks = getClockData().filter(c => c.id !== id);
                localStorage.setItem('ios-clocks', JSON.stringify(clocks));
                renderWorldClocks();
            }
        };

        window.deleteAlarmItem = function(id, e) {
            e.preventDefault();
            if (confirm('删除此闹钟？')) {
                const alarms = getAlarmData().filter(a => a.id !== id);
                localStorage.setItem('ios-alarms', JSON.stringify(alarms));
                renderAlarms();
            }
        };

        let worldClockInterval = null;
        function startWorldClock() {
            updateWorldClock();
            if (!worldClockInterval) {
                worldClockInterval = setInterval(updateWorldClock, 1000);
            }
        }

        function stopWorldClock() {
            if (worldClockInterval) {
                clearInterval(worldClockInterval);
                worldClockInterval = null;
            }
        }

        function updateWorldClock() {
            // 更新本地时间
            const localTimeEl = document.getElementById('local-clock-time');
            const localOffsetEl = document.getElementById('local-clock-offset');
            const now = new Date();
            
            if (localTimeEl) {
                localTimeEl.textContent = now.toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });
            }
            if (localOffsetEl && localOffsetEl.textContent === '正在定位...') {
                localOffsetEl.textContent = '今天，+0小时';
            }

            // 更新其他城市时间
            const timeElements = document.querySelectorAll('.world-clock-time[data-tz]');
            timeElements.forEach(el => {
                const tz = el.getAttribute('data-tz');
                const timeStr = now.toLocaleTimeString('zh-CN', {
                    timeZone: tz,
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });
                el.textContent = timeStr;
            });
        }

        // 获取本地城市信息
        async function fetchLocalCityForClock() {
            const cityEl = document.getElementById('local-clock-city');
            if (!cityEl) return;

            try {
                const apiKey = localStorage.getItem('gaodeApiKey') || GAODE_API_KEY;
                if (!apiKey || apiKey === '在此处粘贴您的高德API密钥') {
                    cityEl.textContent = '未知位置 (未配置API)';
                    return;
                }

                // 先尝试通过浏览器定位
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(async (position) => {
                        const { longitude, latitude } = position.coords;
                        const response = await fetch(`https://restapi.amap.com/v3/geocode/regeo?key=${apiKey}&location=${longitude},${latitude}`);
                        const data = await response.json();
                        if (data.status === '1' && data.regeocode) {
                            const address = data.regeocode.addressComponent;
                            const city = address.city || address.province;
                            cityEl.textContent = Array.isArray(city) ? city[0] : city;
                        }
                    }, async () => {
                        // 如果浏览器定位失败，尝试 IP 定位
                        const response = await fetch(`https://restapi.amap.com/v3/ip?key=${apiKey}`);
                        const data = await response.json();
                        if (data.status === '1') {
                            cityEl.textContent = data.city || '未知城市';
                        }
                    });
                }
            } catch (error) {
                console.error('获取城市失败:', error);
                cityEl.textContent = '未知位置';
            }
        }

        // 计时器逻辑
        window.toggleTimer = function() {
            const btn = document.getElementById('timer-start-btn');
            const progressCircle = document.getElementById('timer-progress');
            const totalDash = 301.59; // 2 * PI * 48

            if (timerRunning) {
                // 暂停
                clearInterval(timerInterval);
                timerRunning = false;
                btn.textContent = '继续';
                btn.classList.remove('running');
                btn.style.background = 'rgba(52, 199, 89, 0.15)';
                btn.style.color = '#34c759';
            } else {
                // 开始/继续
                timerRunning = true;
                btn.textContent = '暂停';
                btn.classList.add('running');
                btn.style.background = 'rgba(255, 59, 48, 0.15)';
                btn.style.color = '#ff3b30';
                
                timerInterval = setInterval(() => {
                    timerSeconds++;
                    updateTimerDisplay();
                    
                    // 模拟进度条（每60秒一圈）
                    const progress = (timerSeconds % 60) / 60;
                    const offset = totalDash * (1 - progress);
                    if (progressCircle) {
                        progressCircle.style.strokeDashoffset = offset;
                    }
                }, 1000);
            }
        };

        window.resetTimer = function() {
            clearInterval(timerInterval);
            timerSeconds = 0;
            timerRunning = false;
            updateTimerDisplay();
            
            const progressCircle = document.getElementById('timer-progress');
            if (progressCircle) progressCircle.style.strokeDashoffset = 0;
            
            const btn = document.getElementById('timer-start-btn');
            btn.textContent = '开始';
            btn.classList.remove('running');
            btn.style.background = 'rgba(52, 199, 89, 0.15)';
            btn.style.color = '#34c759';
        };

        function updateTimerDisplay() {
            const display = document.getElementById('timer-display');
            const hrs = Math.floor(timerSeconds / 3600);
            const mins = Math.floor((timerSeconds % 3600) / 60);
            const secs = timerSeconds % 60;
            display.textContent = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }

        // --- 闹钟与日历逻辑 ---
        function renderCalendar() {
            const daysContainer = document.getElementById('calendar-days');
            const monthYearHeader = document.getElementById('calendar-month-year');
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            
            const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
            monthYearHeader.textContent = `${year}年${monthNames[month]}`;
            
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const prevMonthDays = new Date(year, month, 0).getDate();
            
            let html = '';
            
            // 上个月的剩余天数
            for (let i = firstDay - 1; i >= 0; i--) {
                html += `<div class="calendar-day not-current">${prevMonthDays - i}</div>`;
            }
            
            // 本月天数
            for (let i = 1; i <= daysInMonth; i++) {
                const isToday = i === now.getDate() ? 'today' : '';
                html += `<div class="calendar-day ${isToday}">${i}</div>`;
            }
            
            // 下个月的开始天数
            const totalSlots = 42; // 6 rows * 7 days
            const currentSlots = firstDay + daysInMonth;
            for (let i = 1; i <= totalSlots - currentSlots; i++) {
                html += `<div class="calendar-day not-current">${i}</div>`;
            }
            
            daysContainer.innerHTML = html;
        }

        // --- 备忘录系统逻辑 ---
        let currentNoteId = null;

        function loadNotes() {
            const notesList = document.getElementById('notes-list');
            const notesCount = document.getElementById('notes-count');
            const notes = JSON.parse(localStorage.getItem('ios-notes') || '[]');
            
            notesCount.textContent = `${notes.length} 个备忘录`;
            
            if (notes.length === 0) {
                notesList.innerHTML = `
                    <div class="notes-empty">
                        <i class="fas fa-sticky-note"></i>
                        <p>无备忘录</p>
                    </div>
                `;
                return;
            }

            // 按更新时间降序排序
            notes.sort((a, b) => b.updatedAt - a.updatedAt);

            notesList.innerHTML = notes.map(note => `
                <div class="notes-item" data-id="${note.id}">
                    <div class="notes-item-main" onclick="openNoteEditor('${note.id}')">
                        <div class="notes-item-title">${note.content.split('\n')[0] || '无标题'}</div>
                        <div class="notes-item-info">
                            <span>${new Date(note.updatedAt).toLocaleDateString()}</span>
                            <span>${note.content.split('\n').slice(1).join(' ').substring(0, 30) || '无额外文本'}</span>
                        </div>
                    </div>
                </div>
            `).join('');

            // 初始化长按删除逻辑
            initNotesLongPress();
        }

        function initNotesLongPress() {
            const container = document.getElementById('notes-list');
            if (!container) return;

            let longPressTimer = null;
            let isMoving = false;

            container.querySelectorAll('.notes-item').forEach(item => {
                const startPress = (e) => {
                    isMoving = false;
                    longPressTimer = setTimeout(() => {
                        if (!isMoving) {
                            const id = item.dataset.id;
                            quickDeleteNote(id);
                        }
                    }, 800);
                };

                const endPress = () => {
                    clearTimeout(longPressTimer);
                };

                const movePress = () => {
                    isMoving = true;
                    clearTimeout(longPressTimer);
                };

                // 移除旧的监听器并重新绑定
                item.onmousedown = startPress;
                item.onmouseup = endPress;
                item.onmouseleave = endPress;
                item.onmousemove = movePress;

                item.ontouchstart = startPress;
                item.ontouchend = endPress;
                item.ontouchmove = movePress;
            });
        }

        window.quickDeleteNote = function(id) {
            const overlay = document.getElementById('notes-delete-confirm-overlay');
            const content = overlay ? overlay.querySelector('.clock-modal-content') : null;
            const confirmBtn = document.getElementById('notes-confirm-delete-btn');
            
            if (!overlay || !content || !confirmBtn) return;

            overlay.style.display = 'flex';
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.style.opacity = '1';
                content.style.transform = 'scale(1)';
                content.style.opacity = '1';
            }, 10);

            // 绑定删除逻辑
            confirmBtn.onclick = () => {
                let notes = JSON.parse(localStorage.getItem('ios-notes') || '[]');
                notes = notes.filter(n => n.id !== id);
                localStorage.setItem('ios-notes', JSON.stringify(notes));
                loadNotes();
                closeNotesDeleteModal();
                if (currentNoteId === id) {
                    closeNoteEditor();
                }
            };
        }

        window.closeNotesDeleteModal = function() {
            const overlay = document.getElementById('notes-delete-confirm-overlay');
            const content = overlay ? overlay.querySelector('.clock-modal-content') : null;
            if (overlay && content) {
                overlay.style.opacity = '0';
                content.style.transform = 'scale(1.1)';
                content.style.opacity = '0';
                setTimeout(() => {
                    overlay.style.display = 'none';
                }, 300);
            }
        }

        window.openNoteEditor = function(id = null) {
            // 如果点击的是已经滑开删除按钮的笔记，只收回不打开
            const item = id ? document.querySelector(`.notes-item[data-id="${id}"]`) : null;
            
            const editor = document.getElementById('notes-editor');
            const content = document.getElementById('note-content');
            
            currentNoteId = id;
            if (id) {
                const notes = JSON.parse(localStorage.getItem('ios-notes') || '[]');
                const note = notes.find(n => n.id === id);
                content.value = note ? note.content : '';
            } else {
                content.value = '';
            }

            editor.style.display = 'flex';
            setTimeout(() => editor.classList.add('active'), 10);
            content.focus();
        }

        window.closeNoteEditor = function() {
            const editor = document.getElementById('notes-editor');
            const content = document.getElementById('note-content');
            content.blur(); // 强制收起键盘，防止白边
            editor.classList.remove('active');
            setTimeout(() => editor.style.display = 'none', 300);
        }

        window.saveNote = function() {
            const content = document.getElementById('note-content').value.trim();
            if (!content && !currentNoteId) {
                closeNoteEditor();
                return;
            }

            let notes = JSON.parse(localStorage.getItem('ios-notes') || '[]');
            const now = Date.now();

            if (currentNoteId) {
                if (!content) {
                    // 如果内容为空且是已存在的笔记，则删除
                    notes = notes.filter(n => n.id !== currentNoteId);
                } else {
                    const noteIndex = notes.findIndex(n => n.id === currentNoteId);
                    if (noteIndex > -1) {
                        notes[noteIndex].content = content;
                        notes[noteIndex].updatedAt = now;
                    }
                }
            } else {
                const newNote = {
                    id: 'note_' + now,
                    content: content,
                    createdAt: now,
                    updatedAt: now
                };
                notes.push(newNote);
            }

            localStorage.setItem('ios-notes', JSON.stringify(notes));
            loadNotes();
            closeNoteEditor();
        }

        // --- iOS辅助触控（小白点）自定义功能 ---
        
        // 全局变量存储当前编辑的图片
        let currentEditingImage = null;
        let originalImageWidth = 0;
        let originalImageHeight = 0;
        let aspectRatioLocked = false;
        
        // 处理小白点照片上传
        // --- iOS手势控制系统 (已简化，移除了手势条) ---
        function initGestureControls() {
            // 由于手势条和手势区域已隐藏，此功能已简化
            // 保留函数结构以避免其他代码依赖错误
        }

        // --- iOS 全系列全屏与视口适配逻辑 ---
        function initIOSAdaptation() {
            // 1. 防止橡皮筋效果露底，但允许特定区域滚动
            document.addEventListener('touchmove', function(e) {
                // 优化：使用 closest 检查更具体
                const scrollable = e.target.closest('.app-content, .apps-grid-container, .wechat-chat-list, .wechat-container, .wechat-tab, .wechat-modal-body, .notes-container, .notes-editor-content, #app-appstore, .assistive-touch');
                if (scrollable) {
                    return; 
                }
                if (e.cancelable) e.preventDefault();
            }, { passive: false });

            // 2. 处理 iOS Web App 模式
            if (window.navigator.standalone) {
                document.body.classList.add('ios-standalone');
            }
            
            // 3. 优化高频点击
            document.addEventListener('touchstart', function() {}, { passive: true });
        }

        // 在 DOM 加载完成后初始化适配
        initIOSAdaptation();

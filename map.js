// js/map.js

// ==========================================
// 1. CẤU HÌNH & KHAI BÁO BIẾN
// ==========================================
let map, geojsonLayer, routingControl;
let gpsMarker = null, gpsCircle = null, isTracking = false;
let currentDestination = null; 
let hasRenderedFootball = false; 

const ZONES = {
    ulis:     { fill: '#3498db', color: '#1e293b', label: 'ULIS (Ngoại Ngữ)' },
    khoaphap: { fill: '#3498db', color: '#1e293b', label: 'Khoa Pháp (ULIS)' },
    uet:      { fill: '#e67e22', color: '#1e293b', label: 'UET (Công Nghệ)' },
    ueb:      { fill: '#e74c3c', color: '#1e293b', label: 'UEB (Kinh Tế)' },
    law:      { fill: '#2ecc71', color: '#1e293b', label: 'VNU-LS (Luật)' },
    ued:      { fill: '#9b59b6', color: '#1e293b', label: 'UEd (Giáo Dục)' },
    sis:      { fill: '#f1c40f', color: '#1e293b', label: 'SIS (Liên Ngành)' },
    hsb:      { fill: '#1abc9c', color: '#1e293b', label: 'VNU-HSB (QTKD)' },
    admin:    { fill: '#34495e', color: '#1e293b', label: 'Hành chính' }, 
    beige:    { fill: '#f5cba7', color: '#e67e22', label: 'Ký túc xá / Nhà ở' },
    sports:   { fill: '#73c6b6', color: '#1abc9c', label: 'Cảnh quan' },
    water:    { fill: '#3498db', color: '#2980b9', label: 'Hồ nước' },
    default:  { fill: '#ffffff', color: '#000000', label: 'Chưa rõ' } 
};

const ICONS = { cafe: '☕', food: '🍽️', lib: '📚', park: '🅿️', temple: '⛩️', shop: '🛒', home: '🏠', tree: '🌳', pine: '🌲', stadium: '⚽' };

// MỚI: Chuyển dữ liệu từ api.php sang JavaScript
const LOCATION_INFO = {
    "trung tâm thương mại indochina": { img: "anh/indochina.jpg", desc: "<p>Khu tổ hợp mua sắm, giải trí và ẩm thực hiện đại.</p>" },
    "ký túc xá": { img: "anh/ktx.jpg", desc: "<p>Khu nội trú dành cho sinh viên.</p>" },
    "tòa b2": { img: "anh/toa_b2.jpg", desc: "<p>Giảng đường chung ULIS và VNU-LS.</p>" },
    "ulis": { img: "anh/ulis_chung.jpg", desc: "<p>Khuôn viên trường Đại học Ngoại Ngữ.</p>" },
    "uet": { img: "anh/uet_chung.jpg", desc: "<p>Khuôn viên trường Đại học Công Nghệ.</p>" }
};

// ==========================================
// 2. HELPER FUNCTIONS
// ==========================================
function getZone(n, props) {
    if (n === 'b2' || n.includes('giảng đường b2')) return 'b2_hybrid';
    if (n.includes('pháp') || n.includes('vũ đình liên')) return 'khoaphap'; 
    if (n.includes('chuyên ngoại ngữ') || n.includes('cnn') || n.match(/a[123568]/) || n.includes('b3') || n.includes('nhà ăn ums') || n.includes('ngoại ngữ') || n.match(/c[1-6]/) || n.includes('ulis')) return 'ulis';
    if (n.match(/g[1-3]/) || n.match(/e[235]/) || n.includes('công nghệ') || n.includes('uet') || n === 'd3' || n === 'd4') return 'uet';
    if (n.includes('kinh tế') || n.match(/e[4]/) || n.includes('ueb')) return 'ueb';
    if (n.includes('luật') || n.match(/e[1]/) || n.includes('law')) return 'law';
    if (n.includes('giáo dục') || n.includes('ued') || n === 'g7' || n === 'g8') return 'ued';
    if (n.includes('liên ngành') || n.includes('sis') || n === 'g5') return 'sis';
    if (n === 'b1' || n.includes('quản trị kinh doanh') || n.includes('hsb')) return 'hsb';
    if (n.includes('sunwah') || n === 'g4' || n.includes('nxb') || n.includes('hiệu bộ') || n.includes('điều hành') || n === 'd1' || n === 'd2' || n.includes('hành chính')) return 'admin';
    if (n.includes('ktx') || props.building === 'dormitory') return 'beige';
    return 'default';
}

function getFeatureAppearance(props, name) {
    let result = { emoji: null, isDeco: false };
    if (props.leisure === 'stadium' || props.leisure === 'pitch' || name.includes('sân bóng')) {
        if (!hasRenderedFootball && !props.name) { result.emoji = ICONS.stadium; result.isDeco = true; hasRenderedFootball = true; }
        return result; 
    } 
    if (props.amenity === 'cafe') result.emoji = ICONS.cafe;
    else if (props.amenity === 'restaurant' || name.includes('nhà ăn') || name.includes('canteen')) result.emoji = ICONS.food;
    else if (props.amenity === 'library' || name.includes('thư viện')) result.emoji = ICONS.lib;
    else if (props.amenity === 'parking') result.emoji = ICONS.park;
    else if (props.shop || name.includes('siêu thị')) result.emoji = ICONS.shop;
    else if (name.includes('homies')) result.emoji = ICONS.home;
    else if (name.includes('thánh chúa') || props.religion === 'buddhist') { result.emoji = ICONS.temple; result.isDeco = true; }
    else if (props.landuse === 'grass' && Math.random() > 0.6) { result.emoji = (Math.random() > 0.5 ? ICONS.tree : ICONS.pine); result.isDeco = true; }
    return result;
}

// ==========================================
// 3. CORE MAP LOGIC
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    map = L.map('map', { zoomControl: false, maxZoom: 19 }).setView([21.0382, 105.7826], 17);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    function style2D(feature) {
        const props = feature.properties;
        if (props.highway) {
            let w = 5; let c = '#ffffff'; 
            if (props.highway.match(/primary|trunk/)) { w = 14; c = '#ffffff'; }
            else if (props.highway.match(/secondary|tertiary/)) { w = 9; c = '#ffffff'; }
            return { color: c, weight: w, opacity: 1, lineCap: 'round', lineJoin: 'round' };
        }
        if (props.natural === 'water' || props.waterway) return { color: ZONES.water.color, fillColor: ZONES.water.fill, fillOpacity: 0.9, weight: 2 };
        if (props.leisure || props.landuse === 'grass' || props.natural === 'wood') return { color: ZONES.sports.color, fillColor: ZONES.sports.fill, fillOpacity: 0.8, weight: 1.5 };
        
        if (props.building && props.building !== 'no') {
            const n = (props.name || '').toLowerCase();
            const zone = getZone(n, props);
            if (zone === 'b2_hybrid') return { color: '#ffffff', fillColor: 'url(#b2_gradient)', fillOpacity: 1, weight: 1.5 };
            return { color: ZONES[zone].color, fillColor: ZONES[zone].fill, fillOpacity: 1, weight: 1.5 };
        }
        return { color: 'transparent', fillOpacity: 0 };
    }

    function onEachFeature(feature, layer) {
        const props = feature.properties;
        const n = (props.name || '').toLowerCase();
        const center = layer.getBounds ? layer.getBounds().getCenter() : layer.getLatLng();

        if (props.name && props.building && props.building !== 'no') {
            let displayName = props.name;
            if (n.includes('the loop')) displayName = "TTTM Indochina";
            else if (n.includes('điều hành') || n === 'd2') displayName = "Nhà điều hành";
            else if (n.includes('nguyễn văn đạo') || n === 'd1') displayName = "D1";
            else if (n.includes('cnn') || n.includes('chuyên ngoại ngữ')) displayName = "CNN";
            else displayName = displayName.replace(/(Giảng đường|Tòa|Nhà)\s/i, '');

            L.marker(center, { icon: L.divIcon({ className: 'building-label', html: displayName, iconSize: [80, 20], iconAnchor: [40, 10] }), interactive: false }).addTo(map);
        }

        const app = getFeatureAppearance(props, n);
        let iconButton = null; 
        if (app.emoji) {
            let cssClass = app.isDeco ? 'deco-icon' : 'hust-marker hover:scale-110 transition-transform';
            let size = app.isDeco ? [24, 24] : [26, 26]; 
            let anchor = app.isDeco ? [12, 12] : [13, 13];
            iconButton = L.marker(center, { 
                icon: L.divIcon({ className: cssClass, html: `<div style="font-size: 14px; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">${app.emoji}</div>`, iconSize: size, iconAnchor: anchor }), 
                interactive: !app.isDeco 
            }).addTo(map);
        }

        if (props.name || (app.emoji && !app.isDeco)) {
            const clickHandler = function() {
                const zone = getZone(n, props);
                let displayName = props.name;
                if (!displayName) {
                    if (props.amenity === 'cafe') displayName = 'Quán Cafe';
                    else if (props.amenity === 'restaurant' || props.amenity === 'canteen') displayName = 'Nhà ăn / Canteen';
                    else if (props.amenity === 'library') displayName = 'Thư viện';
                    else if (props.amenity === 'parking') displayName = 'Bãi gửi xe';
                    else displayName = 'Tiện ích VNU';
                }
                const displayType = zone === 'b2_hybrid' ? 'ULIS & VNU-LS' : ZONES[zone].label;

                // MỚI: Xử lý nội dung hiển thị dựa vào LOCATION_INFO
                let fallbackImg = "anh/vnu_default.jpg";
                let descHTML = "<p>Thông tin đang cập nhật.</p>";

                for (const [key, info] of Object.entries(LOCATION_INFO)) {
                    if (n && n.includes(key)) {
                        fallbackImg = info.img;
                        descHTML = info.desc;
                        break;
                    }
                }
                if (fallbackImg === "anh/vnu_default.jpg" && LOCATION_INFO[zone]) {
                    fallbackImg = LOCATION_INFO[zone].img;
                }
                
                const popupContent = `<div class="text-center p-1 min-w-[150px]"><div class="font-bold text-[15px] mb-3 text-slate-800">${displayName}</div><button onclick="startRouting(${center.lat}, ${center.lng})" class="bg-blue-600 text-white border-none py-2 px-4 rounded-full font-bold cursor-pointer transition shadow-md w-full">🧭 Chỉ đường</button></div>`;
                L.popup().setLatLng(center).setContent(popupContent).openOn(map);
                
                // Gọi hàm showPanel (hàm này sẽ tự xử lý việc tìm ảnh)
                window.showPanel(displayName, displayType, center.lat, center.lng, fallbackImg, descHTML, n);
            };

            if (iconButton && !app.isDeco) iconButton.on('click', clickHandler);
            if (props.building && props.building !== 'no') {
                layer.on({
                    click: clickHandler,
                    mouseover: function(e) { e.target.setStyle({ weight: 4, color: '#ffffff' }); e.target.bringToFront(); },
                    mouseout: function(e) { geojsonLayer.resetStyle(e.target); }
                });
            }
        }
    }

    // MỚI: Fetch trực tiếp file geojson, không qua api.php nữa
    fetch('export.geojson')
        .then(res => res.json())
        .then(data => {
            geojsonLayer = L.geoJSON(data, { 
                style: style2D, 
                onEachFeature: onEachFeature,
                pointToLayer: function (feature, latlng) { return L.circleMarker(latlng, { radius: 18, color: 'transparent', fillColor: 'transparent' }); }
            }).addTo(map);
            const b = geojsonLayer.getBounds();
            map.fitBounds(b);
            map.options.minZoom = map.getZoom() - 0.5;
            map.setMaxBounds(b.pad(0.1));
        })
        .catch(err => console.error("Lỗi tải bản đồ:", err));

    // ==========================================
    // 4. SMART SEARCH BAR (TÌM KIẾM)
    // ==========================================
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const clearSearch = document.getElementById('clear-search');

    if(searchInput) {
        searchInput.addEventListener('input', function(e) {
            const val = e.target.value.toLowerCase().trim();
            searchResults.innerHTML = '';
            
            if (!val) { searchResults.classList.add('hidden'); clearSearch.classList.add('hidden'); return; }
            clearSearch.classList.remove('hidden');
            let matches = [];

            if (geojsonLayer) {
                geojsonLayer.eachLayer(layer => {
                    const props = layer.feature.properties;
                    const n = (props.name || '').toLowerCase();
                    let displayName = props.name;
                    if (!displayName) {
                        if (props.amenity === 'cafe') displayName = 'Quán Cafe';
                        else if (props.amenity === 'restaurant' || props.amenity === 'canteen') displayName = 'Nhà ăn / Canteen';
                        else if (props.amenity === 'library') displayName = 'Thư viện';
                    } else if (n.includes('the loop')) displayName = "Trung tâm thương mại Indochina";

                    if (displayName && displayName.toLowerCase().includes(val)) {
                        matches.push({ layer, displayName, zone: getZone(n, props), props, n });
                    }
                });
            }

            let uniqueMatches = [];
            let seenNames = new Set();
            for (let m of matches) {
                if (!seenNames.has(m.displayName)) { seenNames.add(m.displayName); uniqueMatches.push(m); }
                if (uniqueMatches.length >= 6) break; 
            }

            if (uniqueMatches.length > 0) {
                searchResults.classList.remove('hidden');
                uniqueMatches.forEach(match => {
                    const li = document.createElement('li');
                    li.className = 'px-5 py-3 hover:bg-blue-50 cursor-pointer border-b border-slate-100 transition-colors flex items-center gap-4';
                    const app = getFeatureAppearance(match.props, match.n);
                    const icon = app.emoji ? app.emoji : '🏢';

                    li.innerHTML = `<span class="text-2xl">${icon}</span> <div class="flex flex-col"><span class="font-extrabold text-slate-800 text-[14px]">${match.displayName}</span><span class="text-[10px] font-bold text-slate-500 uppercase tracking-wide">${ZONES[match.zone].label}</span></div>`;
                    
                    li.onclick = () => {
                        searchResults.classList.add('hidden');
                        searchInput.value = match.displayName;
                        const center = match.layer.getBounds ? match.layer.getBounds().getCenter() : match.layer.getLatLng();
                        map.flyTo(center, 18, { duration: 1.5, easeLinearity: 0.25 });
                        setTimeout(() => { match.layer.fire('click'); }, 1500);
                    };
                    searchResults.appendChild(li);
                });
            } else {
                searchResults.classList.remove('hidden');
                searchResults.innerHTML = `<li class="px-5 py-4 text-center text-slate-500 font-medium text-sm">Không tìm thấy địa điểm 😅</li>`;
            }
        });

        clearSearch.addEventListener('click', () => {
            searchInput.value = ''; searchResults.classList.add('hidden'); clearSearch.classList.add('hidden'); searchInput.focus();
        });

        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) searchResults.classList.add('hidden');
        });
    }

    // ==========================================
    // 5. GPS & SMART ROUTING
    // ==========================================
    map.on('locationfound', function(e) {
        const btnLocate = document.getElementById('locate-btn');
        btnLocate.innerHTML = '<span class="text-lg">🛑</span> Tắt định vị';
        btnLocate.classList.replace('bg-white', 'bg-blue-600');
        btnLocate.classList.replace('text-blue-600', 'text-white');

        if (!gpsMarker) {
            gpsMarker = L.marker(e.latlng, {icon: L.divIcon({ className: 'bg-transparent border-0', html: '<div class="gps-pulse"></div>', iconSize: [20, 20], iconAnchor: [10, 10] })}).addTo(map);
            gpsCircle = L.circle(e.latlng, e.accuracy / 2, {color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15, weight: 1}).addTo(map);
        } else {
            gpsMarker.setLatLng(e.latlng); gpsCircle.setLatLng(e.latlng).setRadius(e.accuracy / 2);
        }

        if (routingControl && currentDestination) routingControl.setWaypoints([e.latlng, currentDestination]);
    });

    window.toggleGPS = function() {
        if (!isTracking) {
            map.locate({setView: true, maxZoom: 18, watch: true, enableHighAccuracy: true});
            document.getElementById('locate-btn').innerHTML = '<span class="text-lg">⏳</span> Đang định vị...';
            isTracking = true;
        } else {
            map.stopLocate();
            if(gpsMarker) map.removeLayer(gpsMarker);
            if(gpsCircle) map.removeLayer(gpsCircle);
            if(routingControl) map.removeControl(routingControl);
            gpsMarker = gpsCircle = routingControl = currentDestination = null;
            const btnLocate = document.getElementById('locate-btn');
            btnLocate.innerHTML = '<span class="text-lg">📍</span> Vị trí của tôi';
            btnLocate.classList.replace('bg-blue-600', 'bg-white');
            btnLocate.classList.replace('text-white', 'text-blue-600');
            isTracking = false;
        }
    }

    window.startRouting = function(lat, lng) {
        if (!gpsMarker) { alert("Vui lòng bật 'Vị trí của tôi' trước!"); return; }
        currentDestination = L.latLng(lat, lng);
        if (routingControl) map.removeControl(routingControl);
        routingControl = L.Routing.control({
            waypoints: [gpsMarker.getLatLng(), currentDestination],
            router: L.Routing.osrmv1({ serviceUrl: 'https://routing.openstreetmap.de/routed-foot/route/v1', profile: 'foot' }),
            lineOptions: { styles: [{ color: '#3b82f6', opacity: 0.9, weight: 6, dashArray: '10, 10' }], extendToWaypoints: false },
            createMarker: function() { return null; }, addWaypoints: false, draggableWaypoints: false, show: false 
        }).addTo(map);
        window.closePanel();
    }
});

// ==========================================
// 6. QUẢN LÝ GIAO DIỆN PANEL & INDOOR MAP
// ==========================================
window.closePanel = () => document.getElementById('infopanel').classList.replace('right-0', 'right-[-400px]');

window.showPanel = function(name, type, lat, lng, fallbackImgUrl, descHTML, searchKey) {
    document.getElementById('p-name').textContent = name;
    document.getElementById('p-type').textContent = type;
    document.getElementById('p-desc').innerHTML = descHTML;

    // MỚI: Kỹ thuật thay thế cho file_exists() của PHP
    const imgElement = document.getElementById('p-image');
    
    // JS sẽ cố gắng load ảnh với tên tòa nhà (VD: anh/a2.jpg)
    imgElement.src = `anh/${searchKey}.jpg`;
    
    // Nếu Vercel báo lỗi (404 Not Found), JS sẽ tự động đổi sang ảnh Fallback (VD: anh/ulis_chung.jpg hoặc vnu_default.jpg)
    imgElement.onerror = function() {
        imgElement.src = fallbackImgUrl;
        imgElement.onerror = null; // Tránh lặp vô hạn nếu ảnh fallback cũng không tồn tại
    };

    let activeId = searchKey.includes('a2') ? 'a2' : (searchKey === 'b2' || searchKey.includes('b2') ? 'b2_hybrid' : (searchKey.includes('c1') ? 'c1' : searchKey));
    const indoorBtn = document.getElementById('indoor-map-container');
    
    if (typeof INDOOR_DATA !== 'undefined' && INDOOR_DATA[activeId]) {
        window.currentActiveBuilding = activeId;
        indoorBtn.classList.remove('hidden');
    } else {
        window.currentActiveBuilding = '';
        indoorBtn.classList.add('hidden');
    }

    document.getElementById('infopanel').classList.replace('right-[-400px]', 'right-0');
    const routeBtn = document.getElementById('route-btn-panel');
    if(lat && lng) { routeBtn.classList.remove('hidden'); routeBtn.onclick = () => window.startRouting(lat, lng); } 
    else { routeBtn.classList.add('hidden'); }
}
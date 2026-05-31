const weatherCodeMap = {
  0: { text: "晴朗", mood: "sunny" },
  1: { text: "大致晴", mood: "sunny" },
  2: { text: "局部多云", mood: "cloudy" },
  3: { text: "阴天", mood: "cloudy" },
  45: { text: "有雾", mood: "mist" },
  48: { text: "有雾凇", mood: "mist" },
  51: { text: "毛毛雨", mood: "rainy" },
  53: { text: "中等毛毛雨", mood: "rainy" },
  55: { text: "强毛毛雨", mood: "rainy" },
  56: { text: "冻毛毛雨", mood: "rainy" },
  57: { text: "强冻毛毛雨", mood: "rainy" },
  61: { text: "小雨", mood: "rainy" },
  63: { text: "中雨", mood: "rainy" },
  65: { text: "大雨", mood: "rainy" },
  66: { text: "冻雨", mood: "rainy" },
  67: { text: "强冻雨", mood: "rainy" },
  71: { text: "小雪", mood: "snowy" },
  73: { text: "中雪", mood: "snowy" },
  75: { text: "大雪", mood: "snowy" },
  77: { text: "雪粒", mood: "snowy" },
  80: { text: "阵雨", mood: "rainy" },
  81: { text: "较强阵雨", mood: "rainy" },
  82: { text: "暴雨阵雨", mood: "rainy" },
  85: { text: "阵雪", mood: "snowy" },
  86: { text: "强阵雪", mood: "snowy" },
  95: { text: "雷阵雨", mood: "storm" },
  96: { text: "雷阵雨伴小冰雹", mood: "storm" },
  99: { text: "雷阵雨伴大冰雹", mood: "storm" }
};

const placeConfigs = {
  shopping: {
    label: "购物",
    hint: "优先找商场、步行街和综合商业区。"
  },
  relax: {
    label: "放松",
    hint: "优先找咖啡馆、公园和适合停留的安静场所。"
  },
  nature: {
    label: "亲近自然",
    hint: "优先找公园、植物园、湖边和滨水步道。"
  },
  culture: {
    label: "看展逛馆",
    hint: "优先找博物馆、美术馆、图书馆和历史建筑。"
  },
  food: {
    label: "吃吃喝喝",
    hint: "优先找餐厅、咖啡馆和有聚集感的餐饮点。"
  }
};

const transportConfigs = {
  walk: {
    label: "步行",
    radiusLabel: "1.2 公里内",
    firstLeg: "从当前位置步行出发，尽量把今天的路线压缩在一个片区内。",
    travelTime: "单段步行控制在 10 到 20 分钟",
    pace: "轻松慢逛"
  },
  transit: {
    label: "地铁 / 公交",
    radiusLabel: "5 公里内",
    firstLeg: "先走到最近的地铁或公交站，再串联同一条交通走廊上的地点。",
    travelTime: "单段公共交通 15 到 30 分钟",
    pace: "片区串联"
  },
  bike: {
    label: "骑行",
    radiusLabel: "3.5 公里内",
    firstLeg: "优先选相对平缓、连续的人行绿道或城市支路，减少折返。",
    travelTime: "单段骑行 10 到 25 分钟",
    pace: "机动自由"
  },
  drive: {
    label: "打车 / 自驾",
    radiusLabel: "8 公里内",
    firstLeg: "把主目的地放远一点，路上尽量减少停车和换乘成本。",
    travelTime: "单段车程 15 到 35 分钟",
    pace: "效率优先"
  }
};

const dom = {
  locateButton: document.getElementById("locateButton"),
  searchForm: document.getElementById("searchForm"),
  cityInput: document.getElementById("cityInput"),
  purposeSelect: document.getElementById("purposeSelect"),
  transportSelect: document.getElementById("transportSelect"),
  statusMessage: document.getElementById("statusMessage"),
  locationName: document.getElementById("locationName"),
  weatherDescription: document.getElementById("weatherDescription"),
  temperatureValue: document.getElementById("temperatureValue"),
  feelsLikeValue: document.getElementById("feelsLikeValue"),
  rangeValue: document.getElementById("rangeValue"),
  rainValue: document.getElementById("rainValue"),
  windValue: document.getElementById("windValue"),
  timeSuggestion: document.getElementById("timeSuggestion"),
  foodSummary: document.getElementById("foodSummary"),
  mealGrid: document.getElementById("mealGrid"),
  avoidCard: document.getElementById("avoidCard"),
  funRecommendation: document.getElementById("funRecommendation"),
  routePurpose: document.getElementById("routePurpose"),
  routeTransport: document.getElementById("routeTransport"),
  routePace: document.getElementById("routePace"),
  routePlan: document.getElementById("routePlan"),
  placesHint: document.getElementById("placesHint"),
  placeList: document.getElementById("placeList")
};

const storageKey = "local-weather-planner:last-location";

const state = {
  weather: null,
  location: null,
  purpose: dom.purposeSelect.value,
  transport: dom.transportSelect.value,
  places: [],
  placesMeta: null
};

function setStatus(message, isError = false) {
  dom.statusMessage.textContent = message;
  dom.statusMessage.style.color = isError ? "#9f2d1b" : "";
}

function getWeatherMeta(code) {
  return weatherCodeMap[code] || { text: "天气平稳", mood: "mixed" };
}

function formatTemperature(value) {
  return `${Math.round(value)}°C`;
}

function formatDistance(meters) {
  if (!Number.isFinite(meters)) {
    return "距离未知";
  }
  if (meters < 1000) {
    return `约 ${Math.round(meters)} 米`;
  }
  return `约 ${(meters / 1000).toFixed(1)} 公里`;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

function ensureServedOverHttp() {
  if (window.location.protocol === "file:") {
    throw new Error("当前是本地文件模式。请运行 start-preview.ps1，或通过已部署网址访问。");
  }
}

function buildApiUrl(path, params = {}) {
  ensureServedOverHttp();
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url;
}

async function fetchJson(path, params = {}) {
  const url = buildApiUrl(path, params);
  const response = await fetch(url);
  let payload = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.error || "请求失败，请稍后再试。");
  }

  return payload;
}

function getBestTime(weather) {
  const rain = weather.daily.precipitation_probability_max[0];
  const wind = weather.current.wind_speed_10m;

  if (rain >= 60 || wind >= 28) {
    return "下午到傍晚，优先室内安排";
  }

  if (weather.current.temperature_2m >= 31) {
    return "上午 9 点前或傍晚";
  }

  if (weather.current.temperature_2m <= 10) {
    return "中午前后更舒服";
  }

  return "上午 10 点到傍晚 5 点半";
}

function getSnapshot(weather) {
  const weatherMeta = getWeatherMeta(weather.current.weather_code);
  return {
    mood: weatherMeta.mood,
    weatherText: weatherMeta.text,
    currentTemp: weather.current.temperature_2m,
    apparentTemp: weather.current.apparent_temperature,
    rainChance: weather.daily.precipitation_probability_max[0],
    windSpeed: weather.current.wind_speed_10m,
    high: Math.round(weather.daily.temperature_2m_max[0]),
    low: Math.round(weather.daily.temperature_2m_min[0]),
    isDay: weather.current.is_day === 1
  };
}

function buildMealPlan(snapshot) {
  const hot = snapshot.currentTemp >= 30;
  const cold = snapshot.currentTemp <= 12;
  const wet = snapshot.mood === "rainy" || snapshot.rainChance >= 55;
  const storm = snapshot.mood === "storm";
  const windy = snapshot.windSpeed >= 24;

  const summary = storm
    ? {
        title: "今天三餐建议走稳妥、热乎、少折腾路线",
        description: "天气不稳定，吃饭重点是缩短折返和等待时间，优先温热、扎实、容易找到的组合。"
      }
    : hot
      ? {
          title: "今天三餐建议偏清爽、补水、别太油",
          description: "气温高，重点是减少油腻和下午犯困，让你吃完还能继续出门。"
        }
      : cold
        ? {
            title: "今天三餐建议偏热量和保暖感",
            description: "体感偏冷，三餐要更重视热汤、主食和温度，别让出门状态越走越差。"
          }
        : wet
          ? {
              title: "今天三餐建议偏热汤和现做现吃",
              description: "雨天和潮湿天气会放大口感和温度需求，热汤、热菜、热主食会更舒服。"
            }
          : {
              title: "今天三餐可以按正常节奏安排，但要讲究搭配",
              description: "天气没有太强限制，重点是让每餐既好吃又不拖累后面的出行状态。"
            };

  let breakfast;
  let lunch;
  let dinner;
  let avoid;

  if (storm) {
    breakfast = {
      tag: "早餐",
      title: "小米粥 + 茶叶蛋 + 葱油饼",
      reason: "雷雨天早上更适合热的主食和蛋白质，能快速把体感拉起来，也不容易在路上饿。",
      details: ["主食：小米粥和葱油饼，入口热，胃舒服。", "配菜：茶叶蛋补蛋白，早上更稳。"]
    };
    lunch = {
      tag: "午餐",
      title: "番茄牛腩面 + 烫青菜",
      reason: "中午需要一顿既能顶住通勤也不容易踩雷的正餐，汤面加牛肉比冷食更适合雷雨天气。",
      details: ["主食：番茄牛腩面。", "菜：加一份生菜或上海青，避免全是淀粉。"]
    };
    dinner = {
      tag: "晚餐",
      title: "砂锅鸡煲饭 + 菌菇汤",
      reason: "晚上更适合收束行程，吃一顿热的、坐得住的，不再额外折腾。",
      details: ["主食：煲仔饭或砂锅饭。", "菜：鸡煲或菌菇类热菜，雨天体感更舒服。"]
    };
    avoid = {
      title: "不建议吃冰饮、纯生冷沙拉、需要久排队的网红店",
      reason: "雷雨天气会让体感更差，生冷和久等会同时拉低舒适度和行程稳定性。"
    };
  } else if (hot) {
    breakfast = {
      tag: "早餐",
      title: "豆浆 + 鸡蛋三明治 + 玉米",
      reason: "热天早餐要轻一点但不能空，碳水和蛋白质一起上，出门不发懵。",
      details: ["主食：全麦三明治和玉米。", "菜 / 配料：生菜、番茄、鸡蛋，补水感更强。"]
    };
    lunch = {
      tag: "午餐",
      title: "凉面 + 手撕鸡 + 黄瓜",
      reason: "中午最热，适合清爽但不单薄的组合，既有主食也有蛋白和蔬菜。",
      details: ["主食：凉面或荞麦面。", "菜：手撕鸡、黄瓜丝、胡萝卜丝。"]
    };
    dinner = {
      tag: "晚餐",
      title: "寿司饭卷 + 味噌汤 + 烤南瓜",
      reason: "晚上如果还要逛，晚餐别太油；米饭类主食加热汤，体感会更平衡。",
      details: ["主食：寿司卷或饭团。", "菜：烤南瓜、海藻沙拉或清炒时蔬。"]
    };
    avoid = {
      title: "不建议吃重油火锅、奶油焗饭、超辣烤肉",
      reason: "高温天吃得太油太辣容易更燥、更口渴，下午和晚上都容易犯困。"
    };
  } else if (cold) {
    breakfast = {
      tag: "早餐",
      title: "热豆浆 + 肉包 + 红薯",
      reason: "偏冷天气早上需要迅速补热量，热饮加扎实主食会比冷面包更顶用。",
      details: ["主食：肉包和红薯。", "配菜：热豆浆，提升体感。"]
    };
    lunch = {
      tag: "午餐",
      title: "咖喱鸡肉饭 + 西兰花",
      reason: "中午适合吃有温度、有酱汁的米饭类，既暖和又不至于太笨重。",
      details: ["主食：米饭。", "菜：咖喱鸡肉、西兰花或胡萝卜。"]
    };
    dinner = {
      tag: "晚餐",
      title: "番茄牛腩锅 + 手擀面",
      reason: "晚餐适合彻底把身体暖起来，一锅式的热菜和主食更适合收尾。",
      details: ["主食：手擀面或米饭。", "菜：牛腩、番茄、白萝卜。"]
    };
    avoid = {
      title: "不建议吃纯冷盘、冰粉、空腹喝冰咖啡",
      reason: "冷天本来体感就低，生冷食物会让胃和整体状态都更往下掉。"
    };
  } else if (wet || windy) {
    breakfast = {
      tag: "早餐",
      title: "皮蛋瘦肉粥 + 小笼包",
      reason: "潮湿或风大时，早餐宜热不宜干，粥和蒸点更顺口，也不容易噎。",
      details: ["主食：粥和小笼包。", "菜：瘦肉粥里已经有一定蛋白。"]
    };
    lunch = {
      tag: "午餐",
      title: "牛肉汤粉 + 凉拌木耳",
      reason: "中午适合一碗带汤的主食，既能顶饿，也不会像大油炒菜那样吃完发闷。",
      details: ["主食：米粉或河粉。", "菜：木耳、青菜，平衡口感。"]
    };
    dinner = {
      tag: "晚餐",
      title: "煎三文鱼饭 + 南瓜浓汤",
      reason: "晚上需要稍微收一收，吃得有营养但别太撑，方便后续回程。",
      details: ["主食：米饭。", "菜：三文鱼、南瓜汤、时蔬。"]
    };
    avoid = {
      title: "不建议吃纯炸物拼盘、太干的烘焙主食、一路边走边吃",
      reason: "风大或潮湿时，过干过油的食物会放大不适感，也不利于边走边玩的节奏。"
    };
  } else {
    breakfast = {
      tag: "早餐",
      title: "鸡蛋饼 + 无糖酸奶 + 香蕉",
      reason: "正常天气下，早餐要够快也要够稳，轻主食加蛋白最适合出门前状态。",
      details: ["主食：鸡蛋饼。", "配菜：酸奶和香蕉，补一点能量。"]
    };
    lunch = {
      tag: "午餐",
      title: "黑椒牛肉饭 + 清炒西兰花",
      reason: "中午需要一顿效率高的正餐，米饭类最稳，配一份蔬菜不容易腻。",
      details: ["主食：米饭。", "菜：黑椒牛肉和西兰花。"]
    };
    dinner = {
      tag: "晚餐",
      title: "菌菇鸡汤面 + 凉拌菠菜",
      reason: "晚上适合比中午清一点，但保留热量和汤水，方便继续散步或回家。",
      details: ["主食：汤面。", "菜：菌菇、鸡丝和菠菜。"]
    };
    avoid = {
      title: "不建议三餐都吃重油重盐、连续喝高糖饮料",
      reason: "天气平稳不代表身体扛得住连续高负担，容易把后面的出行状态吃垮。"
    };
  }

  return { summary, meals: [breakfast, lunch, dinner], avoid };
}

function renderMealPlan(plan) {
  dom.foodSummary.innerHTML = `
    <h3>${plan.summary.title}</h3>
    <p>${plan.summary.description}</p>
  `;

  dom.mealGrid.innerHTML = plan.meals
    .map(
      (meal) => `
        <article class="meal-card">
          <p class="meal-tag">${meal.tag}</p>
          <h3>${meal.title}</h3>
          <p>${meal.reason}</p>
          <ul>
            ${meal.details.map((item) => `<li>${item}</li>`).join("")}
          </ul>
        </article>
      `
    )
    .join("");

  dom.avoidCard.innerHTML = `
    <p class="meal-tag">不建议吃什么</p>
    <h3>${plan.avoid.title}</h3>
    <p>${plan.avoid.reason}</p>
  `;
}

function dedupePlaces(places) {
  const seen = new Set();
  return places.filter((place) => {
    const key = `${place.name}-${place.lat}-${place.lon}`;
    if (!place.name || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function normalizePlace(place) {
  return {
    id: place.id,
    name: place.name || "附近地点",
    lat: place.lat,
    lon: place.lon,
    distance: place.distance,
    category: place.category || "综合地点",
    area: place.area || "",
    tags: place.tags || {}
  };
}

async function fetchNearbyPlaces(location, purpose, transport) {
  const data = await fetchJson("/api/places", {
    lat: location.latitude,
    lon: location.longitude,
    purpose,
    transport
  });

  return {
    places: dedupePlaces((data.places || []).map(normalizePlace)),
    meta: data.meta || null
  };
}

function buildPurposeIntro(snapshot, purpose) {
  const label = placeConfigs[purpose].label;

  if (purpose === "shopping") {
    return snapshot.mood === "rainy" || snapshot.mood === "storm"
      ? `${label}优先安排在商场或大型商业综合体内，减少淋雨和频繁转场。`
      : `${label}可以放在下午到傍晚，边逛边吃，节奏最好。`;
  }

  if (purpose === "nature") {
    return snapshot.currentTemp >= 31
      ? `${label}建议压到早晚，避免正午暴晒。`
      : `${label}今天适合放大步行和停留时间。`;
  }

  if (purpose === "culture") {
    return `${label}适合放在中午到下午，室内体感更稳定，也不太受天气波动影响。`;
  }

  if (purpose === "food") {
    return `${label}适合把吃饭和散步串起来，让路线围着餐饮密集片区展开。`;
  }

  return `${label}适合以一个主场所为核心，再留一点机动时间慢慢待。`;
}

function buildRoutePlan(snapshot, location, places, purpose, transport) {
  const purposeConfig = placeConfigs[purpose];
  const transportConfig = transportConfigs[transport];
  const primary = places[0];
  const secondary = places[1];
  const tertiary = places[2];
  const pace = snapshot.currentTemp >= 31
    ? "上午和傍晚更密，中午收缩"
    : snapshot.mood === "rainy" || snapshot.mood === "storm"
      ? "以室内停留为主，少折返"
      : transportConfig.pace;

  const intro = buildPurposeIntro(snapshot, purpose);
  const opening = primary
    ? `从 ${location.label} 出发，首站先去 ${primary.name}。`
    : `从 ${location.label} 出发，先锁定一个符合“${purposeConfig.label}”目标的主地点。`;

  const steps = [
    `第 1 段：${transportConfig.firstLeg}`,
    `第 2 段：${opening}${primary ? ` 这段距离大约 ${formatDistance(primary.distance)}。` : ""}`,
    secondary
      ? `第 3 段：从 ${primary ? primary.name : "首站"} 再转去 ${secondary.name}，保持 ${transportConfig.travelTime} 的节奏。`
      : "第 3 段：围绕首站周边继续活动，不要把路线拉得过散。",
    tertiary
      ? `第 4 段：如果体力和天气都允许，再补一个 ${tertiary.name} 作为收尾。`
      : "第 4 段：把最后一段留给吃饭或回程，不要为了凑点而硬折返。"
  ];

  return {
    title: `${purposeConfig.label}路线更适合这样走`,
    description: `${intro} 今天建议的整体节奏是“${pace}”。`,
    pace,
    steps
  };
}

function renderPlaces(places, purpose, transport) {
  const purposeConfig = placeConfigs[purpose];
  const transportConfig = transportConfigs[transport];
  const providerHint = state.placesMeta?.provider
    ? ` 数据来源：${state.placesMeta.provider}${state.placesMeta.staleFallback ? "（使用缓存兜底）" : ""}。`
    : "";
  dom.placesHint.textContent = `${purposeConfig.hint} 当前按照 ${transportConfig.radiusLabel} 的范围筛选。${providerHint}`;

  if (!places.length) {
    dom.placeList.innerHTML = `
      <li class="place-item empty">
        当前没有拿到可用的具体场所数据。你可以换一个出游目的、交通工具，或者搜索更大的城市名再试。
      </li>
    `;
    return;
  }

  dom.placeList.innerHTML = places
    .map(
      (place, index) => `
        <li class="place-item">
          <div class="place-top">
            <div class="place-copy">
              <h4>${index + 1}. ${place.name}</h4>
              <p>${getPlaceDescription(place, purpose)}</p>
            </div>
            <span class="place-chip">${purposeConfig.label}</span>
          </div>
          <div class="place-meta">
            <span><strong>距离</strong> ${formatDistance(place.distance)}</span>
            <span><strong>类型</strong> ${formatCategory(place.category)}</span>
            <span><strong>建议方式</strong> ${transportConfig.label}</span>
          </div>
        </li>
      `
    )
    .join("");
}

function formatCategory(category) {
  return category
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getPlaceDescription(place, purpose) {
  if (purpose === "shopping") {
    return "适合作为今天购物主场，先逛主店，再看周边餐饮和补充买手店。";
  }
  if (purpose === "nature") {
    return "更适合留一点停留时间，走一段、坐一段，不要只打卡就走。";
  }
  if (purpose === "culture") {
    return "适合作为主展览或馆藏点，建议把停留时长放到 1 到 2 小时。";
  }
  if (purpose === "food") {
    return "适合作为今天的核心吃喝点，可以把正餐和咖啡都围着这里安排。";
  }
  return "适合作为慢节奏停留点，别把路线排得太满。";
}

function renderRoutePlan(route, purpose, transport) {
  dom.routePurpose.textContent = placeConfigs[purpose].label;
  dom.routeTransport.textContent = transportConfigs[transport].label;
  dom.routePace.textContent = route.pace;
  dom.funRecommendation.innerHTML = `
    <h3>${route.title}</h3>
    <p>${route.description}</p>
  `;
  dom.routePlan.innerHTML = `
    <ul class="route-steps">
      ${route.steps.map((step) => `<li>${step}</li>`).join("")}
    </ul>
  `;
}

function renderWeather(locationLabel, weather) {
  const snapshot = getSnapshot(weather);

  dom.locationName.textContent = locationLabel;
  dom.weatherDescription.textContent = `现在 ${snapshot.weatherText}，今天最高 ${snapshot.high}°C，最低 ${snapshot.low}°C。`;
  dom.temperatureValue.textContent = formatTemperature(weather.current.temperature_2m);
  dom.feelsLikeValue.textContent = `体感 ${formatTemperature(weather.current.apparent_temperature)}`;
  dom.rangeValue.textContent = `${snapshot.high}°C / ${snapshot.low}°C`;
  dom.rainValue.textContent = `${weather.daily.precipitation_probability_max[0]}%`;
  dom.windValue.textContent = `${Math.round(weather.current.wind_speed_10m)} km/h`;
  dom.timeSuggestion.textContent = getBestTime(weather);

  const mealPlan = buildMealPlan(snapshot);
  renderMealPlan(mealPlan);
}

async function fetchWeather(latitude, longitude) {
  return fetchJson("/api/weather", {
    lat: latitude,
    lon: longitude
  });
}

async function fetchCityCoordinates(cityName) {
  return fetchJson("/api/geocode", {
    city: cityName
  });
}

async function updatePlaceRecommendations() {
  if (!state.weather || !state.location) {
    return;
  }

  const snapshot = getSnapshot(state.weather);
  const purpose = state.purpose;
  const transport = state.transport;
  const route = buildRoutePlan(snapshot, state.location, state.places, purpose, transport);
  renderRoutePlan(route, purpose, transport);
  renderPlaces(state.places, purpose, transport);

  setStatus(`正在更新 ${placeConfigs[purpose].label} 场所...`);

  try {
    const placeResult = await fetchNearbyPlaces(state.location, purpose, transport);
    state.places = placeResult.places;
    state.placesMeta = placeResult.meta;
    const nextRoute = buildRoutePlan(snapshot, state.location, placeResult.places, purpose, transport);
    renderRoutePlan(nextRoute, purpose, transport);
    renderPlaces(placeResult.places, purpose, transport);
    setStatus(`已更新 ${state.location.label} 的天气、三餐和路线建议。`);
  } catch (error) {
    state.places = [];
    state.placesMeta = null;
    const fallbackRoute = buildRoutePlan(snapshot, state.location, [], purpose, transport);
    renderRoutePlan(fallbackRoute, purpose, transport);
    renderPlaces([], purpose, transport);
    setStatus(
      error.message || "附近场所加载失败。请稍后重试，或配置更稳定的地图服务提供方。",
      true
    );
  }
}

async function loadByCoordinates(label, latitude, longitude) {
  setStatus("正在获取天气与附近场所数据...");
  state.location = { label, latitude, longitude };

  try {
    const weather = await fetchWeather(latitude, longitude);
    state.weather = weather;
    renderWeather(label, weather);
    localStorage.setItem(storageKey, JSON.stringify(state.location));
    state.places = [];
    state.placesMeta = null;
    await updatePlaceRecommendations();
  } catch (error) {
    setStatus(error.message || "数据加载失败。", true);
  }
}

function handleLocate() {
  if (!navigator.geolocation) {
    setStatus("当前浏览器不支持定位，请改用城市搜索。", true);
    return;
  }

  setStatus("正在请求定位权限...");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      loadByCoordinates("当前位置", latitude, longitude);
    },
    () => {
      setStatus("定位失败，请改用城市搜索。", true);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

async function handleSearch(event) {
  event.preventDefault();
  const cityName = dom.cityInput.value.trim();

  if (!cityName) {
    setStatus("先输入城市名再搜索。", true);
    return;
  }

  setStatus(`正在搜索 ${cityName} ...`);

  try {
    const location = await fetchCityCoordinates(cityName);
    await loadByCoordinates(location.label, location.latitude, location.longitude);
  } catch (error) {
    setStatus(error.message || "城市搜索失败。", true);
  }
}

function handlePreferenceChange() {
  state.purpose = dom.purposeSelect.value;
  state.transport = dom.transportSelect.value;
  if (state.location && state.weather) {
    state.places = [];
    updatePlaceRecommendations();
  }
}

function restoreLastLocation() {
  if (window.location.protocol === "file:") {
    return;
  }

  const saved = localStorage.getItem(storageKey);
  if (!saved) {
    return;
  }

  try {
    const location = JSON.parse(saved);
    if (
      !location.label ||
      !Number.isFinite(location.latitude) ||
      !Number.isFinite(location.longitude)
    ) {
      return;
    }
    loadByCoordinates(location.label, location.latitude, location.longitude);
  } catch {
    localStorage.removeItem(storageKey);
  }
}

dom.locateButton.addEventListener("click", handleLocate);
dom.searchForm.addEventListener("submit", handleSearch);
dom.purposeSelect.addEventListener("change", handlePreferenceChange);
dom.transportSelect.addEventListener("change", handlePreferenceChange);

if (window.location.protocol === "file:") {
  setStatus("当前是本地文件模式。请运行 start-preview.ps1，或访问已部署的网址。", true);
}

restoreLastLocation();

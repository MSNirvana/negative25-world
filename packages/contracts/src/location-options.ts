export type ChinaRegionDefinition = {
  id: string;
  nameZh: string;
  nameEn: string;
  aliases: string[];
};

/** The complete set of mainland provinces, municipalities, autonomous regions, and SARs. */
export const CHINA_REGION_DEFINITIONS: readonly ChinaRegionDefinition[] = [
  { id: 'beijing', nameZh: '北京市', nameEn: 'Beijing', aliases: ['北京', '北京市', 'beijing'] },
  { id: 'tianjin', nameZh: '天津市', nameEn: 'Tianjin', aliases: ['天津', '天津市', 'tianjin'] },
  { id: 'hebei', nameZh: '河北省', nameEn: 'Hebei', aliases: ['河北', '河北省', 'hebei'] },
  { id: 'shanxi', nameZh: '山西省', nameEn: 'Shanxi', aliases: ['山西', '山西省', 'shanxi', '大同', 'datong', '云冈', '云冈石窟', 'yungang', '五台山', '五台山风景名胜区', 'wutai mountain', 'wutaishan', '北岳恒山', 'beiyue hengshan'] },
  { id: 'inner-mongolia', nameZh: '内蒙古自治区', nameEn: 'Inner Mongolia', aliases: ['内蒙古', '内蒙古自治区', 'inner mongolia', 'innermongolia'] },
  { id: 'liaoning', nameZh: '辽宁省', nameEn: 'Liaoning', aliases: ['辽宁', '辽宁省', 'liaoning'] },
  { id: 'jilin', nameZh: '吉林省', nameEn: 'Jilin', aliases: ['吉林', '吉林省', 'jilin'] },
  { id: 'heilongjiang', nameZh: '黑龙江省', nameEn: 'Heilongjiang', aliases: ['黑龙江', '黑龙江省', 'heilongjiang'] },
  { id: 'shanghai', nameZh: '上海市', nameEn: 'Shanghai', aliases: ['上海', '上海市', 'shanghai'] },
  { id: 'jiangsu', nameZh: '江苏省', nameEn: 'Jiangsu', aliases: ['江苏', '江苏省', 'jiangsu'] },
  { id: 'zhejiang', nameZh: '浙江省', nameEn: 'Zhejiang', aliases: ['浙江', '浙江省', 'zhejiang'] },
  { id: 'anhui', nameZh: '安徽省', nameEn: 'Anhui', aliases: ['安徽', '安徽省', 'anhui'] },
  { id: 'fujian', nameZh: '福建省', nameEn: 'Fujian', aliases: ['福建', '福建省', 'fujian'] },
  { id: 'jiangxi', nameZh: '江西省', nameEn: 'Jiangxi', aliases: ['江西', '江西省', 'jiangxi'] },
  { id: 'shandong', nameZh: '山东省', nameEn: 'Shandong', aliases: ['山东', '山东省', 'shandong'] },
  { id: 'henan', nameZh: '河南省', nameEn: 'Henan', aliases: ['河南', '河南省', 'henan'] },
  { id: 'hubei', nameZh: '湖北省', nameEn: 'Hubei', aliases: ['湖北', '湖北省', 'hubei'] },
  { id: 'hunan', nameZh: '湖南省', nameEn: 'Hunan', aliases: ['湖南', '湖南省', 'hunan'] },
  { id: 'guangdong', nameZh: '广东省', nameEn: 'Guangdong', aliases: ['广东', '广东省', 'guangdong'] },
  { id: 'guangxi', nameZh: '广西壮族自治区', nameEn: 'Guangxi', aliases: ['广西', '广西壮族自治区', 'guangxi'] },
  { id: 'hainan', nameZh: '海南省', nameEn: 'Hainan', aliases: ['海南', '海南省', 'hainan'] },
  { id: 'chongqing', nameZh: '重庆市', nameEn: 'Chongqing', aliases: ['重庆', '重庆市', 'chongqing'] },
  { id: 'sichuan', nameZh: '四川省', nameEn: 'Sichuan', aliases: ['四川', '四川省', 'sichuan'] },
  { id: 'guizhou', nameZh: '贵州省', nameEn: 'Guizhou', aliases: ['贵州', '贵州省', 'guizhou'] },
  { id: 'yunnan', nameZh: '云南省', nameEn: 'Yunnan', aliases: ['云南', '云南省', 'yunnan'] },
  { id: 'tibet', nameZh: '西藏自治区', nameEn: 'Tibet', aliases: ['西藏', '西藏自治区', 'tibet', 'xizang'] },
  { id: 'shaanxi', nameZh: '陕西省', nameEn: 'Shaanxi', aliases: ['陕西', '陕西省', 'shaanxi'] },
  { id: 'gansu', nameZh: '甘肃省', nameEn: 'Gansu', aliases: ['甘肃', '甘肃省', 'gansu'] },
  { id: 'qinghai', nameZh: '青海省', nameEn: 'Qinghai', aliases: ['青海', '青海省', 'qinghai'] },
  { id: 'ningxia', nameZh: '宁夏回族自治区', nameEn: 'Ningxia', aliases: ['宁夏', '宁夏回族自治区', 'ningxia'] },
  { id: 'xinjiang', nameZh: '新疆维吾尔自治区', nameEn: 'Xinjiang', aliases: ['新疆', '新疆维吾尔自治区', 'xinjiang'] },
  { id: 'hong-kong', nameZh: '香港特别行政区', nameEn: 'Hong Kong', aliases: ['香港', '香港特别行政区', 'hong kong', 'hongkong'] },
  { id: 'macao', nameZh: '澳门特别行政区', nameEn: 'Macao', aliases: ['澳门', '澳门特别行政区', '澳門', 'macao', 'macau'] },
  { id: 'taiwan', nameZh: '台湾省', nameEn: 'Taiwan', aliases: ['台湾', '台湾省', '臺灣', 'taiwan'] },
] as const;

export type OverseasRegionDefinition = {
  id: string;
  nameZh: string;
  nameEn: string;
  aliases: string[];
};

/** Common country aliases used to merge manually named overseas locations. */
export const OVERSEAS_REGION_DEFINITIONS: readonly OverseasRegionDefinition[] = [
  { id: 'singapore', nameZh: '新加坡', nameEn: 'Singapore', aliases: ['新加坡', 'Singapore', 'Republic of Singapore'] },
  { id: 'japan', nameZh: '日本', nameEn: 'Japan', aliases: ['日本', 'Japan'] },
  { id: 'italy', nameZh: '意大利', nameEn: 'Italy', aliases: ['意大利', 'Italy'] },
  { id: 'canada', nameZh: '加拿大', nameEn: 'Canada', aliases: ['加拿大', 'Canada'] },
  { id: 'united-states', nameZh: '美国', nameEn: 'United States', aliases: ['美国', 'United States', 'United States of America', 'USA'] },
  { id: 'united-kingdom', nameZh: '英国', nameEn: 'United Kingdom', aliases: ['英国', '英國', 'United Kingdom', 'Great Britain', 'Britain', 'UK', 'England', 'Scotland', 'Wales'] },
  { id: 'australia', nameZh: '澳大利亚', nameEn: 'Australia', aliases: ['澳大利亚', '澳洲', 'Australia'] },
  { id: 'new-zealand', nameZh: '新西兰', nameEn: 'New Zealand', aliases: ['新西兰', 'New Zealand'] },
  { id: 'france', nameZh: '法国', nameEn: 'France', aliases: ['法国', 'France'] },
  { id: 'germany', nameZh: '德国', nameEn: 'Germany', aliases: ['德国', 'Germany'] },
  { id: 'switzerland', nameZh: '瑞士', nameEn: 'Switzerland', aliases: ['瑞士', 'Switzerland'] },
  { id: 'austria', nameZh: '奥地利', nameEn: 'Austria', aliases: ['奥地利', 'Austria'] },
  { id: 'spain', nameZh: '西班牙', nameEn: 'Spain', aliases: ['西班牙', 'Spain'] },
  { id: 'portugal', nameZh: '葡萄牙', nameEn: 'Portugal', aliases: ['葡萄牙', 'Portugal'] },
  { id: 'netherlands', nameZh: '荷兰', nameEn: 'Netherlands', aliases: ['荷兰', 'Netherlands', 'Holland'] },
  { id: 'thailand', nameZh: '泰国', nameEn: 'Thailand', aliases: ['泰国', 'Thailand'] },
  { id: 'malaysia', nameZh: '马来西亚', nameEn: 'Malaysia', aliases: ['马来西亚', 'Malaysia'] },
  { id: 'indonesia', nameZh: '印度尼西亚', nameEn: 'Indonesia', aliases: ['印度尼西亚', '印尼', 'Indonesia'] },
  { id: 'vietnam', nameZh: '越南', nameEn: 'Vietnam', aliases: ['越南', 'Vietnam'] },
  { id: 'south-korea', nameZh: '韩国', nameEn: 'South Korea', aliases: ['韩国', '南韩', 'South Korea', 'Republic of Korea'] },
  { id: 'philippines', nameZh: '菲律宾', nameEn: 'Philippines', aliases: ['菲律宾', 'Philippines'] },
  { id: 'india', nameZh: '印度', nameEn: 'India', aliases: ['印度', 'India'] },
  { id: 'nepal', nameZh: '尼泊尔', nameEn: 'Nepal', aliases: ['尼泊尔', 'Nepal'] },
  { id: 'sri-lanka', nameZh: '斯里兰卡', nameEn: 'Sri Lanka', aliases: ['斯里兰卡', 'Sri Lanka'] },
  { id: 'united-arab-emirates', nameZh: '阿联酋', nameEn: 'United Arab Emirates', aliases: ['阿联酋', 'United Arab Emirates', 'UAE'] },
  { id: 'turkey', nameZh: '土耳其', nameEn: 'Turkey', aliases: ['土耳其', 'Turkey', 'Türkiye'] },
  { id: 'russia', nameZh: '俄罗斯', nameEn: 'Russia', aliases: ['俄罗斯', 'Russia'] },
  { id: 'egypt', nameZh: '埃及', nameEn: 'Egypt', aliases: ['埃及', 'Egypt'] },
  { id: 'south-africa', nameZh: '南非', nameEn: 'South Africa', aliases: ['南非', 'South Africa'] },
  { id: 'brazil', nameZh: '巴西', nameEn: 'Brazil', aliases: ['巴西', 'Brazil'] },
  { id: 'mexico', nameZh: '墨西哥', nameEn: 'Mexico', aliases: ['墨西哥', 'Mexico'] },
  { id: 'argentina', nameZh: '阿根廷', nameEn: 'Argentina', aliases: ['阿根廷', 'Argentina'] },
  { id: 'chile', nameZh: '智利', nameEn: 'Chile', aliases: ['智利', 'Chile'] },
  { id: 'peru', nameZh: '秘鲁', nameEn: 'Peru', aliases: ['秘鲁', 'Peru'] },
] as const;

export function normalizeLocationText(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[\s,，、·._/\\-]+/g, '');
}

export function locationMatchesRegion(value: string, region: ChinaRegionDefinition): boolean {
  const normalized = normalizeLocationText(value);
  return region.aliases.some((alias) => normalized.includes(normalizeLocationText(alias)));
}

export function regionForLocation(value: string): ChinaRegionDefinition | undefined {
  return CHINA_REGION_DEFINITIONS.find((region) => locationMatchesRegion(value, region));
}

export function overseasRegionForLocation(value: string): OverseasRegionDefinition | undefined {
  const normalized = normalizeLocationText(value);
  if (!normalized) return undefined;
  const segments = value.split(/[·•|,/，、()[\]（）]+/u).map(normalizeLocationText).filter(Boolean);
  return OVERSEAS_REGION_DEFINITIONS.find((region) => region.aliases.some((alias) => {
    const normalizedAlias = normalizeLocationText(alias);
    if (!normalizedAlias) return false;
    if (normalized === normalizedAlias || segments.includes(normalizedAlias)) return true;
    return normalizedAlias.length >= 3 && (normalized.includes(normalizedAlias) || segments.some((segment) => segment.includes(normalizedAlias)));
  }));
}

export function overseasRegionForId(value: string): OverseasRegionDefinition | undefined {
  const normalized = normalizeLocationText(value);
  return OVERSEAS_REGION_DEFINITIONS.find((region) => normalizeLocationText(region.id) === normalized || normalizeLocationText(region.nameZh) === normalized || normalizeLocationText(region.nameEn) === normalized || region.aliases.some((alias) => normalizeLocationText(alias) === normalized));
}

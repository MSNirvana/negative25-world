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

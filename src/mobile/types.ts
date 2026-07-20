// 移动端水印相机 — 类型定义（独立于桌面端 src/types，避免耦合）

/** 水印模板 */
export interface WatermarkTemplate {
  id: string;
  name: string;
  fields: {
    /** 显示拍摄时间 */
    time: boolean;
    /** 显示项目名称 */
    project: boolean;
    /** 显示经纬度坐标 */
    coords: boolean;
    /** 显示地址/位置描述 */
    address: boolean;
    /** 显示拍摄人 */
    photographer: boolean;
    /** 自定义水印文字（空字符串=不显示） */
    customText: string;
  };
  style: {
    position: 'bottom' | 'bottomLeft';
    theme: 'dark' | 'blue' | 'orange';
  };
  updatedAt: string;
}

/** 水印内容上下文（拍摄现场信息） */
export interface WatermarkContext {
  time: string;
  projectName: string;
  latitude: number | null;
  longitude: number | null;
  address: string;
  photographer: string;
}

/** 定位结果 */
export interface GeoResult {
  ok: boolean;
  latitude: number | null;
  longitude: number | null;
  /** 定位不可用原因: insecure(非HTTPS) / denied(用户拒绝) / timeout / unsupported */
  reason?: 'insecure' | 'denied' | 'timeout' | 'unsupported';
}

/** 项目条目（保留 id，桌面端 fetchProjects 丢弃了 id 不可复用） */
export interface MobileProject {
  id: number;
  name: string;
}

/** 上传队列条目 */
export interface UploadItem {
  id: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  fileName: string;
  error?: string;
  thumbUrl?: string;
}

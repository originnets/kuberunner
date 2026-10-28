import { CloudServerOutlined } from '@ant-design/icons';
import { createStyles } from 'antd-style';
import React from 'react';

const useStyles = createStyles(({ token, css }) => ({
  footer: css`
    padding: 16px 24px;
    text-align: center;
    color: ${token.colorTextDescription};
    font-size: ${token.fontSizeSM}px;
    line-height: ${token.lineHeight};
    background: transparent;
  `,
  brand: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: ${token.colorTextSecondary};
    font-weight: 500;
  `,
  meta: css`
    margin-top: 4px;
    font-family: ${token.fontFamilyCode};
    font-size: ${token.fontSizeSM - 1}px;
    color: ${token.colorTextQuaternary};
  `,
}));

const Footer: React.FC = () => {
  const { styles } = useStyles();

  return (
    <div className={styles.footer}>
      <div className={styles.brand}>
        <CloudServerOutlined />
        KubeRunner · Kubernetes 多集群管理平台
      </div>
      <div className={styles.meta}>
        © {new Date().getFullYear()} KubeRunner · v{__APP_VERSION__}
      </div>
    </div>
  );
};

export default Footer;

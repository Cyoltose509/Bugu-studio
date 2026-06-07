/**
 * 邮箱验证邮件模板
 * 使用 React Email 组件渲染
 */

import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Heading,
} from "@react-email/components";

interface VerificationEmailProps {
  code: string;
}

export function VerificationEmail({ code }: VerificationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>验证你的布谷工作室邮箱</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>布谷工作室 🐦</Heading>
          <Section style={section}>
            <Text style={text}>感谢注册布谷工作室！</Text>
            <Text style={text}>你的邮箱验证码为：</Text>
            <Section style={codeBox}>
              <Text style={codeText}>{code}</Text>
            </Section>
            <Text style={hint}>
              验证码有效期为 10 分钟，请在页面中输入以完成验证。
            </Text>
            <Text style={hint}>
              如果这不是你的操作，请忽略此邮件。
            </Text>
          </Section>
          <Section style={footer}>
            <Text style={footerText}>
              布谷工作室 · 游戏开发社团
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = {
  margin: 0,
  padding: "24px",
  backgroundColor: "#F0F5F9",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const container: React.CSSProperties = {
  maxWidth: "480px",
  margin: "0 auto",
  backgroundColor: "#fff",
  borderRadius: "12px",
  overflow: "hidden",
  boxShadow: "0 4px 24px rgba(37, 84, 122, 0.08)",
};

const heading: React.CSSProperties = {
  margin: 0,
  padding: "28px 32px 0",
  fontSize: "24px",
  fontWeight: 700,
  color: "#25547A",
  textAlign: "center" as const,
};

const section: React.CSSProperties = {
  padding: "24px 32px 32px",
};

const text: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: "15px",
  lineHeight: "24px",
  color: "#333333",
};

const codeBox: React.CSSProperties = {
  margin: "20px auto",
  padding: "16px 24px",
  backgroundColor: "#E6F0F8",
  borderRadius: "8px",
  textAlign: "center" as const,
};

const codeText: React.CSSProperties = {
  margin: 0,
  fontSize: "32px",
  fontWeight: 700,
  letterSpacing: "6px",
  color: "#25547A",
  fontFamily: "'Courier New', Courier, monospace",
};

const hint: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: "13px",
  lineHeight: "20px",
  color: "#777777",
  textAlign: "center" as const,
};

const footer: React.CSSProperties = {
  padding: "16px 32px",
  backgroundColor: "#25547A",
};

const footerText: React.CSSProperties = {
  margin: 0,
  fontSize: "12px",
  color: "rgba(255,255,255,0.7)",
  textAlign: "center" as const,
};

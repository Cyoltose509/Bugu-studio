/**
 * 密码重置邮件模板
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
  Link,
} from "@react-email/components";

interface ResetPasswordEmailProps {
  resetUrl: string;
}

export function ResetPasswordEmail({ resetUrl }: ResetPasswordEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>重置你的布谷工作室密码</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>布谷工作室 🐦</Heading>
          <Section style={section}>
            <Text style={text}>你请求重置密码。</Text>
            <Text style={text}>
              点击下方按钮在 30 分钟内完成密码重置：
            </Text>
            <Section style={{ textAlign: "center" as const, margin: "24px 0" }}>
              <Link href={resetUrl} style={button}>
                重置密码
              </Link>
            </Section>
            <Text style={hint}>
              或者复制以下链接到浏览器：
            </Text>
            <Text style={linkText}>{resetUrl}</Text>
            <Text style={hint}>
              如果这不是你的操作，请忽略此邮件，密码不会被修改。
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

const button: React.CSSProperties = {
  display: "inline-block",
  padding: "12px 32px",
  background: "linear-gradient(135deg, #E38043 0%, #F09055 100%)",
  color: "#fff",
  fontSize: "15px",
  fontWeight: 600,
  borderRadius: "8px",
  textDecoration: "none",
};

const hint: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: "13px",
  lineHeight: "20px",
  color: "#777777",
  textAlign: "center" as const,
};

const linkText: React.CSSProperties = {
  margin: "4px 0 12px",
  fontSize: "12px",
  lineHeight: "18px",
  color: "#3388BB",
  textAlign: "center" as const,
  wordBreak: "break-all" as const,
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

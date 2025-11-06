import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Palette, ShoppingBag, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import heroImage from "@/assets/hero-cake.jpg";

const Index = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[600px] flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ 
            backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.8)), url(${heroImage})`,
          }}
        />
        <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            AI가 디자인하는<br />당신만의 케이크
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            원하는 스타일과 크기를 선택하면, AI가 3가지 맞춤 디자인을 제안합니다.<br />
            당신의 특별한 순간을 더 특별하게 만들어드립니다.
          </p>
          <Link to="/design/size">
            <Button size="lg" className="text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-all">
              케이크 디자인 시작하기
              <Sparkles className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 bg-secondary/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">간단한 4단계로 완성</h2>
          <div className="grid md:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <Card key={index} className="text-center transition-all hover:shadow-lg">
                <CardContent className="pt-8 pb-6">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4">
                    <step.icon className="h-8 w-8 text-white" />
                  </div>
                  <div className="text-3xl font-bold mb-2 text-primary">{index + 1}</div>
                  <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">왜 선택해야 할까요?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-2 hover:border-primary transition-all">
                <CardContent className="pt-8">
                  <feature.icon className="h-12 w-12 text-primary mb-4" />
                  <h3 className="text-2xl font-semibold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-primary/10 to-accent/10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">지금 바로 시작하세요</h2>
          <p className="text-xl text-muted-foreground mb-8">
            5분 안에 당신만의 특별한 케이크 디자인을 받아보세요
          </p>
          <Link to="/design/size">
            <Button size="lg" className="text-lg px-8 py-6">
              무료로 디자인 받기
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};

const steps = [
  {
    icon: ShoppingBag,
    title: "사이즈 선택",
    description: "케이크 크기와 서빙 인원을 선택합니다"
  },
  {
    icon: Palette,
    title: "스타일 선택",
    description: "원하는 케이크 스타일을 고릅니다"
  },
  {
    icon: Sparkles,
    title: "AI 제안",
    description: "AI가 3가지 맞춤 디자인을 생성합니다"
  },
  {
    icon: Clock,
    title: "예약 확정",
    description: "마음에 드는 디자인을 선택하고 예약합니다"
  }
];

const features = [
  {
    icon: Sparkles,
    title: "AI 맞춤 디자인",
    description: "최신 AI 기술로 당신의 취향에 맞는 독특한 디자인을 생성합니다"
  },
  {
    icon: Clock,
    title: "빠른 제안",
    description: "몇 분 만에 전문가 수준의 케이크 디자인 제안을 받을 수 있습니다"
  },
  {
    icon: Palette,
    title: "다양한 스타일",
    description: "모던, 로맨틱, 빈티지 등 다양한 스타일 중에서 선택할 수 있습니다"
  }
];

export default Index;

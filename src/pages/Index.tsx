// Update this page (the content is just a fallback if you fail to update the page)
import heroBg from "@/assets/hero-bg.jpg";

const Index = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative">
      {/* Background Image */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-80"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        <div className="absolute inset-0 bg-background/90"></div>
      </div>
      <div className="text-center relative z-10">
        <h1 className="mb-4 text-4xl font-bold">Welcome to Your Blank App</h1>
        <p className="text-xl text-muted-foreground">Start building your amazing project here!</p>
      </div>
    </div>
  );
};

export default Index;

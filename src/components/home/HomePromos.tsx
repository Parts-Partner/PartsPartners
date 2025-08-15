import React from 'react';
import { UserPlus, MapPin, ShoppingBag } from 'lucide-react';

export const HomePromos: React.FC<{
  onRegister: () => void;
  onFindTech: () => void;
  onBulk: () => void;
}> = ({ onRegister, onFindTech, onBulk }) => {
  const Card: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode; cta: React.ReactNode }> = ({
    icon,
    title,
    children,
    cta,
  }) => (
    <div className="bg-white border rounded-2xl p-6 shadow-sm">
      <div className="w-14 h-14 rounded-2xl grid place-items-center bg-red-100 text-red-600 mb-4">{icon}</div>
      <h3 className="text-2xl font-extrabold tracking-tight mb-2">{title}</h3>
      <div className="text-gray-600 leading-relaxed mb-5">{children}</div>
      {cta}
    </div>
  );

  const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = (props) => (
    <button
      {...props}
      className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold shadow-sm hover:shadow transition
        bg-red-600 text-white hover:bg-red-700`}
    />
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      <Card
        icon={<UserPlus size={28} />}
        title="Become a Partner!"
        cta={<Btn onClick={onRegister}>Register Now</Btn>}
      >
        Service technicians are the backbone of our industry. Join our growing community to unlock
        exclusive discounts, priority support, and perks designed for experts who keep the world running.
      </Card>

      <Card
        icon={<MapPin size={28} />}
        title="Find a Technician!"
        cta={<Btn onClick={onFindTech}>Find Tech</Btn>}
      >
        Connect with our rapidly expanding network of qualified professionals nationwide. Finding the
        right expert has never been easier—or more reliable.
      </Card>

      <Card
        icon={<ShoppingBag size={28} />}
        title="Bulk Order"
        cta={<Btn onClick={onBulk}>Bulk Order</Btn>}
      >
        Need multiple parts quickly? Paste your part numbers and quantities—we’ll handle the rest with
        streamlined large-order tools.
      </Card>
    </div>
  );
};

export default HomePromos;

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  billingService,
  Plan,
  Subscription,
  Usage,
  formatPrice,
  formatBytes,
  getUsagePercentage,
  getTierBadgeColor,
  getStatusBadgeColor,
} from '@/lib/billing';

export default function BillingPage() {
  const params = useParams();
  const tenantSlug = (params?.tenant as string) || '';

  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [tenantSlug]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [plansRes, subscriptionRes, usageRes] = await Promise.all([
        billingService.getPlans(),
        billingService.getSubscription(),
        billingService.getUsage(),
      ]);

      setPlans(plansRes.plans);
      setSubscription(subscriptionRes.subscription);
      setUsage(usageRes);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (plan: Plan) => {
    try {
      setProcessing(plan.id);
      setError(null);

      const result = await billingService.createCheckout(plan.id);

      if (result.checkoutUrl) {
        // Redirect to MercadoPago checkout
        window.location.href = result.checkoutUrl;
      } else if (result.redirectUrl) {
        // Free plan or direct activation
        window.location.href = result.redirectUrl;
      } else if (result.message) {
        // Show success message and reload
        alert(result.message);
        loadData();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleCancelSubscription = async (immediately: boolean) => {
    if (
      !confirm(
        immediately
          ? '¿Estás seguro de cancelar la suscripción inmediatamente? Perderás acceso a las funciones premium.'
          : '¿Estás seguro de cancelar la suscripción al final del período actual?'
      )
    ) {
      return;
    }

    try {
      setProcessing('cancel');
      await billingService.cancelSubscription(immediately);
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleReactivate = async () => {
    try {
      setProcessing('reactivate');
      await billingService.reactivateSubscription();
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-lg p-6 h-64"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Facturación</h1>
          <p className="text-gray-600 mt-2">
            Gestiona tu suscripción y consulta tu uso
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Current Usage */}
        {usage && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Uso Actual</h2>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-gray-600">Plan actual:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getTierBadgeColor(usage.tier)}`}>
                {usage.tier}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Requests */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Solicitudes</span>
                  <span className="font-medium">
                    {usage.usage.requests.toLocaleString()} / {usage.quotas.maxRequests.toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      getUsagePercentage(usage.usage.requests, usage.quotas.maxRequests) > 90
                        ? 'bg-red-500'
                        : getUsagePercentage(usage.usage.requests, usage.quotas.maxRequests) > 70
                        ? 'bg-yellow-500'
                        : 'bg-blue-500'
                    }`}
                    style={{ width: `${getUsagePercentage(usage.usage.requests, usage.quotas.maxRequests)}%` }}
                  ></div>
                </div>
              </div>

              {/* WhatsApp Messages */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Mensajes WhatsApp</span>
                  <span className="font-medium">
                    {usage.usage.whatsappMessages.toLocaleString()} / {usage.quotas.maxRequests.toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      getUsagePercentage(usage.usage.whatsappMessages, usage.quotas.maxRequests) > 90
                        ? 'bg-red-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${getUsagePercentage(usage.usage.whatsappMessages, usage.quotas.maxRequests)}%` }}
                  ></div>
                </div>
              </div>

              {/* Storage */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Almacenamiento</span>
                  <span className="font-medium">
                    {formatBytes(usage.usage.storage)} / {formatBytes(usage.quotas.maxStorage)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-purple-500"
                    style={{ width: `${getUsagePercentage(usage.usage.storage, usage.quotas.maxStorage)}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-500 mt-4">
              Período: {new Date(usage.period.start).toLocaleDateString('es-MX')} -{' '}
              {new Date(usage.period.end).toLocaleDateString('es-MX')}
            </p>
          </div>
        )}

        {/* Current Subscription */}
        {subscription?.hasSubscription && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Suscripción Actual</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Plan</p>
                <p className="font-medium">{subscription.plan}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Estado</p>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeColor(subscription.status || '')}`}>
                  {subscription.status}
                </span>
              </div>
              {subscription.currentPeriodEnd && (
                <div>
                  <p className="text-sm text-gray-600">Próxima renovación</p>
                  <p className="font-medium">
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString('es-MX')}
                  </p>
                </div>
              )}
              {subscription.cancelAtPeriodEnd && (
                <div className="col-span-2 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
                  Tu suscripción se cancelará al final del período actual.
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-4">
              {subscription.cancelAtPeriodEnd ? (
                <button
                  onClick={handleReactivate}
                  disabled={processing === 'reactivate'}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {processing === 'reactivate' ? 'Procesando...' : 'Reactivar Suscripción'}
                </button>
              ) : subscription.status === 'ACTIVE' ? (
                <>
                  <button
                    onClick={() => handleCancelSubscription(false)}
                    disabled={processing === 'cancel'}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    {processing === 'cancel' ? 'Procesando...' : 'Cancelar al Final del Período'}
                  </button>
                  <button
                    onClick={() => handleCancelSubscription(true)}
                    disabled={processing === 'cancel'}
                    className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50"
                  >
                    Cancelar Inmediatamente
                  </button>
                </>
              ) : null}
            </div>
          </div>
        )}

        {/* Plans */}
        <h2 className="text-xl font-semibold mb-4">Planes Disponibles</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrentPlan = subscription?.plan === plan.name;
            const isProcessingThis = processing === plan.id;

            return (
              <div
                key={plan.id}
                className={`bg-white rounded-lg shadow p-6 border-2 ${
                  isCurrentPlan ? 'border-blue-500' : 'border-transparent'
                } ${plan.id.includes('enterprise') ? 'ring-2 ring-purple-500' : ''}`}
              >
                {plan.id.includes('enterprise') && (
                  <div className="text-center -mt-10 mb-4">
                    <span className="bg-purple-500 text-white text-xs px-3 py-1 rounded-full">
                      POPULAR
                    </span>
                  </div>
                )}

                <h3 className="text-xl font-semibold">{plan.name}</h3>
                <div className="mt-4 mb-6">
                  <span className="text-3xl font-bold">{formatPrice(plan.price, plan.currency)}</span>
                  {plan.price > 0 && (
                    <span className="text-gray-500">
                      /{plan.interval === 'monthly' ? 'mes' : 'año'}
                    </span>
                  )}
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <svg
                        className="w-5 h-5 text-green-500 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-sm text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelectPlan(plan)}
                  disabled={isCurrentPlan || isProcessingThis || processing !== null}
                  className={`w-full py-2 px-4 rounded-lg font-medium ${
                    isCurrentPlan
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : plan.id.includes('enterprise')
                      ? 'bg-purple-600 text-white hover:bg-purple-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  } disabled:opacity-50`}
                >
                  {isCurrentPlan
                    ? 'Plan Actual'
                    : isProcessingThis
                    ? 'Procesando...'
                    : plan.price === 0
                    ? 'Seleccionar Gratis'
                    : 'Seleccionar Plan'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Payment Info */}
        <div className="mt-8 bg-gray-100 rounded-lg p-6">
          <h3 className="font-semibold mb-2">Métodos de Pago</h3>
          <p className="text-sm text-gray-600">
            Aceptamos tarjetas de crédito/débito, transferencias bancarias y efectivo a través de MercadoPago.
            Los pagos se procesan de forma segura y tus datos están protegidos.
          </p>
          <div className="mt-4 flex gap-4">
            <img
              src="https://www.mercadopago.com/org-img/MP3/home/argentina/logo-mercadopago.svg"
              alt="MercadoPago"
              className="h-8"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

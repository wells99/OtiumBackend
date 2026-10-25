import { paymentService } from "../services/paymentService.js";

export const paymentController = {
  async create(req, res, next) {
    try {
      const { amount = 29.9, provider = "mercadopago", externalPaymentId } = req.body ?? {};
      const payment = await paymentService.createPayment({
        userId: req.user.id,
        amount,
        provider,
        externalPaymentId,
      });

      return res.status(201).json({
        message: "Cobrança gerada com sucesso.",
        payment,
      });
    } catch (err) {
      next(err);
    }
  },

  async webhook(req, res, next) {
    try {
      // Suporte flexível para payload de webhook
      const externalId = req.body?.data?.id || req.body?.id || req.query?.id;

      if (!externalId) {
        return res.status(400).json({ error: "Identificador de pagamento não fornecido no webhook." });
      }

      const result = await paymentService.processPaymentApproval(String(externalId), req.body);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
};

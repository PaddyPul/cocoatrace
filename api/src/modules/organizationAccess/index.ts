import { config } from '../../config/env';
import { AppError } from '../../errors';
import { deliverInvitation } from '../../services/invitationDelivery';
import { sendVerificationEmail } from '../../services/emailSender';
import { OrganizationAccessController } from './controller';
import { PostgresOrganizationAccessRepository } from './repository';
import { organizationAccessRoutes } from './routes';
import { OrganizationAccessService } from './service';
import { OrganizationAccessEmailPort } from './types';

const exposeRawLinks = config.environment === 'demo' || config.environment === 'test';

const accessEmail: OrganizationAccessEmailPort = {
  async sendAccessVerification(message) {
    const result = await sendVerificationEmail({
      to: message.recipientEmail,
      recipientName: message.recipientName,
      organizationName: message.organizationName,
      verificationUrl: message.verificationUrl,
    });
    if (result.status === 'suppressed' && !exposeRawLinks) {
      throw new AppError('Email verification delivery is not configured', 503, 'EMAIL_DELIVERY_UNAVAILABLE');
    }
    return result;
  },
  sendFirstAdminInvitation: (input) => deliverInvitation({
    id: input.invitationId, token: input.token, to: input.recipientEmail,
    invitationUrl: input.invitationUrl, recipientName: input.recipientName,
    organizationName: input.organizationName,
  }),
};

const service = new OrganizationAccessService(
  new PostgresOrganizationAccessRepository(),
  accessEmail,
  config.publicWebUrl,
  exposeRawLinks,
);

export default organizationAccessRoutes(new OrganizationAccessController(service));

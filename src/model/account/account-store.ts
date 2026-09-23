import * as _ from 'lodash';
import { observable, computed } from 'mobx';

import { lazyObservablePromise } from '../../util/observable';

// Local User interface for simplified account management
interface User {
    email?: string;
    featureFlags?: string[];
    banned?: boolean;
    subscription?: any;
    userId?: string;
    teamSubscription?: any;
    // Upstream code calls these as methods on the user object:
    isPaidUser(): boolean;
    isPastDueUser(): boolean;
    userHasSubscription(): boolean;
}

// ------------------------------------------------------------------
// You could override settings in here to become a paid user for free.
// I'd rather you didn't! HTTP Toolkit takes time & love to build,
// and I can't do that if it doesn't pay my bills :-)
//
// Fund open source - if you want Pro, help pay for its development.
// Can't afford it? Get in touch: tim@httptoolkit.com.
// ------------------------------------------------------------------
export class AccountStore {

    constructor() {
        console.log('Account store initialized');
    }

    readonly initialized = lazyObservablePromise(async () => {
        // No initialization needed - all users have Pro access
        console.log('Account store initialized');
    });

    // Stub subscription plans - not needed since all users have Pro access
    subscriptionPlans = {
        state: 'fulfilled' as const,
        value: {}
    };

    // Stub account update process - always false since no updates needed
    // No account modals exist in this fork (login/plan-picker/checkout are removed),
    // so this is permanently undefined. Kept because upstream's zip-export logic
    // reads it to close the export dialog when another modal opens.
    @observable
    modal: undefined = undefined;

    @observable
    isAccountUpdateInProcess = false;

    @observable
    accountDataLastUpdated = Date.now();

    @observable
    user: User = {
        featureFlags: [],
        banned: false,
        // Hardcoded Pro: every user is treated as a paid subscriber.
        isPaidUser: () => true,
        isPastDueUser: () => false,
        userHasSubscription: () => true
    };

    @computed get userEmail() {
        return this.user.email;
    }

    @computed get userSubscription() {
        return this.user.subscription;
    }

    @computed get isLoggedIn() {
        return !!this.user.email;
    }

    @computed get featureFlags() {
        return _.clone(this.user.featureFlags || []);
    }

    // Hardcoded Pro status - all users have Pro access
    @computed get isPaidUser() {
        return true;
    }

    @computed get isPastDueUser() {
        return false;
    }

    @computed get userHasSubscription() {
        return true;
    }

    @computed get mightBePaidUser() {
        return true;
    }

    // No real account backs this fork, so there is normally no JWT to delegate.
    // Returns false (rather than throwing, as upstream does) so the server bridge
    // simply treats the session as unauthenticated.
    get userJwt(): string | false {
        try {
            return localStorage.getItem('last_jwt') || false;
        } catch (e) {
            return false;
        }
    }

    get canManageSubscription() {
        return false; // No subscription management needed
    }

    // Stub methods for compatibility - no-op since all users have Pro access
    getPro(source: string) {
        // No-op: all users already have Pro access
    }

    logIn() {
        // No-op: no authentication needed
        return Promise.resolve(true);
    }

    logOut() {
        // No-op: no authentication to log out from
    }

    setSelectedPlan(plan: any) {
        // No-op: no plan selection needed
    }

    cancelCheckout() {
        // No-op: no checkout to cancel
    }

    cancelSubscription() {
        // No-op: no subscription to cancel
        return Promise.resolve();
    }

}
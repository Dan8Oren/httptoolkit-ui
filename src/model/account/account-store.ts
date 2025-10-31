import * as _ from 'lodash';
import { observable, computed } from 'mobx';

import { User } from '@httptoolkit/accounts';
import { lazyObservablePromise } from '../../util/observable';

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
    @observable
    isAccountUpdateInProcess = false;

    @observable
    accountDataLastUpdated = Date.now();

    @observable
    private user: User = {
        featureFlags: [],
        banned: false
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
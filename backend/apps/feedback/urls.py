from django.urls import path

from . import views

urlpatterns = [
    path("", views.FeedbackCreateView.as_view(), name="feedback-create"),
    path("mine/", views.MyFeedbackView.as_view(), name="feedback-mine"),
    path("eligible-orders/", views.EligibleFeedbackOrdersView.as_view(), name="feedback-eligible-orders"),
]
